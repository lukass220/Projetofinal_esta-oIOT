const CONFIG = {
  host: "10.0.0.252",
  port: 9001,
  topics: {
    temperatura: "aulas/grupo5Lucas/temperatura",
    umidade: "aulas/grupo5Lucas/umidade",
    qualidadeAr: "aulas/grupo5Lucas/qualidade_ar",
  },
  storage: {
    temperatura: "iot_temperatura",
    umidade: "iot_umidade",
    qualidadeAr: "iot_qualidade_ar",
  },
};

let client = null;
let reconexaoAgendada = false;

document.addEventListener("DOMContentLoaded", () => {
  restaurarDados();
  criarInformacoesExtras();

  if (typeof Paho === "undefined") {
    atualizarStatus("MQTT indisponível: verifique a internet", false);
    return;
  }

  conectarMQTT();
});

function atualizarStatus(texto, conectado) {
  const statusDiv = document.getElementById("status");

  if (!statusDiv) {
    return;
  }

  statusDiv.textContent = texto;
  statusDiv.className = conectado
    ? "status connected"
    : "status disconnected";
}

function conectarMQTT() {
  if (typeof Paho === "undefined") {
    atualizarStatus("Biblioteca MQTT não carregada", false);
    return;
  }

  const clientID = "WebDash_" + Math.random().toString(16).slice(2, 10);

  try {
    client = new Paho.MQTT.Client(CONFIG.host, CONFIG.port, clientID);
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    atualizarStatus("Status: Conectando...", false);
    client.connect({
      timeout: 5,
      onSuccess: onConnect,
      onFailure: onFailure,
    });
  } catch (error) {
    console.error("Erro ao iniciar MQTT:", error);
    atualizarStatus("Status: Erro ao iniciar MQTT", false);
    agendarReconexao();
  }
}

function onConnect() {
  atualizarStatus("Status: Conectado ao Mosquitto", true);

  Object.values(CONFIG.topics).forEach((topic) => client.subscribe(topic));
  atualizarUltimaAtualizacao("Conexão estabelecida");
  reconexaoAgendada = false;
}

function onFailure(responseObject) {
  const mensagem = responseObject?.errorMessage || "broker indisponível";

  atualizarStatus("Status: Falha na conexão (" + mensagem + ")", false);
  agendarReconexao();
}

function onConnectionLost(responseObject) {
  if (responseObject?.errorCode === 0) {
    return;
  }

  atualizarStatus("Status: Conexão perdida. Tentando novamente...", false);
  agendarReconexao();
}

function agendarReconexao() {
  if (reconexaoAgendada) {
    return;
  }

  reconexaoAgendada = true;
  window.setTimeout(() => {
    reconexaoAgendada = false;
    conectarMQTT();
  }, 5000);
}

function onMessageArrived(message) {
  const valor = Number.parseFloat(message.payloadString);
  const configuracao = obterConfiguracaoDoTopico(message.destinationName);

  if (!configuracao || Number.isNaN(valor)) {
    console.warn("Leitura MQTT inválida:", message.payloadString);
    return;
  }

  const elemento = document.getElementById(configuracao.id);

  if (elemento) {
    elemento.textContent = valor.toFixed(configuracao.decimais);
  }

  localStorage.setItem(configuracao.storage, String(valor));
  atualizarAlerta(configuracao, valor);
  atualizarUltimaAtualizacao();
}

function obterConfiguracaoDoTopico(topic) {
  const configuracoes = [
    {
      topic: CONFIG.topics.temperatura,
      id: "temp",
      storage: CONFIG.storage.temperatura,
      decimais: 1,
      limite: 28,
      alerta: "Temperatura acima de 28 °C",
    },
    {
      topic: CONFIG.topics.umidade,
      id: "hum",
      storage: CONFIG.storage.umidade,
      decimais: 1,
      limite: 56,
      alerta: "Umidade acima de 56%",
    },
    {
      topic: CONFIG.topics.qualidadeAr,
      id: "air",
      storage: CONFIG.storage.qualidadeAr,
      decimais: 0,
      limite: 400,
      alerta: "Qualidade do ar em nível de alerta",
    },
  ];

  return configuracoes.find((configuracao) => configuracao.topic === topic);
}

function atualizarAlerta(configuracao, valor) {
  const elemento = document.getElementById(configuracao.id);
  const card = elemento?.closest(".card");

  if (!card) {
    return;
  }

  card.classList.toggle("alerta", valor > configuracao.limite);
  card.title = valor > configuracao.limite ? configuracao.alerta : "Leitura normal";
}

function restaurarDados() {
  const configuracoes = Object.values(CONFIG.storage);
  const ids = ["temp", "hum", "air"];
  const decimais = [1, 1, 0];

  configuracoes.forEach((chave, indice) => {
    const valorSalvo = localStorage.getItem(chave);
    const elemento = document.getElementById(ids[indice]);
    const numero = Number.parseFloat(valorSalvo);

    if (elemento && !Number.isNaN(numero)) {
      elemento.textContent = numero.toFixed(decimais[indice]);
    }
  });
}

function criarInformacoesExtras() {
  const statusDiv = document.getElementById("status");

  if (!statusDiv || document.getElementById("ultimaAtualizacao")) {
    return;
  }

  const atualizacao = document.createElement("small");
  atualizacao.id = "ultimaAtualizacao";
  atualizacao.textContent = "Aguardando leituras...";
  statusDiv.insertAdjacentElement("afterend", atualizacao);
}

function atualizarUltimaAtualizacao(mensagem = "Leitura recebida") {
  const elemento = document.getElementById("ultimaAtualizacao");

  if (elemento) {
    elemento.textContent = `${mensagem} às ${new Date().toLocaleTimeString("pt-BR")}`;
  }
}

