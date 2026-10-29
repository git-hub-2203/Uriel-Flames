import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getDatabase,
    onValue,
    ref,
    runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBB4XVurihnpUILd3rmECnbaJrVUhmL70o",
    authDomain: "termotech-740c1.firebaseapp.com",
    databaseURL: "https://termotech-740c1-default-rtdb.firebaseio.com",
    projectId: "termotech-740c1",
    storageBucket: "termotech-740c1.firebasestorage.app",
    messagingSenderId: "671626210689",
    appId: "1:671626210689:web:0500fce94b0a255b4ecc80",
    measurementId: "G-YH05EXB3FB",
};

const database = getDatabase(initializeApp(firebaseConfig));
const temperatureValue = document.querySelector("#temperature-value");
const humidityValue = document.querySelector("#humidity-value");
const temperatureStatus = document.querySelector("#temperature-status");
const humidityStatus = document.querySelector("#humidity-status");
const connectionStatus = document.querySelector("#connection-status");
const ledStatus = document.querySelector("#led-status");
const ledToggle = document.querySelector("#led-toggle");
const connectedSensors = new Set();
const failedSensors = new Set();
const ledRef = ref(database, "Sensor/LED");
let ledState = false;
let ledAvailable = false;
let ledUpdating = false;

function displayReading(snapshot, valueElement, statusElement, databasePath) {
    if (!snapshot.exists()) {
        valueElement.textContent = "--";
        statusElement.textContent = `Sem leitura em /${databasePath}.`;
        return;
    }

    const reading = Number(snapshot.val());
    if (!Number.isFinite(reading)) {
        valueElement.textContent = "--";
        statusElement.textContent = "Valor recebido inválido.";
        return;
    }

    valueElement.textContent = new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1,
    }).format(reading);
    statusElement.textContent = "Atualizado em tempo real";
}

function updateConnectionStatus() {
    if (failedSensors.size > 0) {
        connectionStatus.textContent = "Erro de leitura. Verifique a conexão e as regras do Realtime Database.";
        connectionStatus.classList.add("error");
    } else if (connectedSensors.size === 3) {
        connectionStatus.textContent = "Conectado · atualizações em tempo real";
        connectionStatus.classList.remove("error");
    } else {
        connectionStatus.textContent = "Conectando ao banco de dados...";
    }
}

function updateLedControl() {
    ledToggle.disabled = !ledAvailable || ledUpdating;
    ledToggle.textContent = ledState ? "Desligar LED" : "Ligar LED";
    ledToggle.setAttribute("aria-pressed", String(ledState));
}

function listenToSensor(path, valueElement, statusElement) {
    onValue(
        ref(database, path),
        (snapshot) => {
            connectedSensors.add(path);
            failedSensors.delete(path);
            displayReading(snapshot, valueElement, statusElement, path);
            updateConnectionStatus();
        },
        (error) => {
            failedSensors.add(path);
            connectedSensors.delete(path);
            console.error(`Não foi possível ler ${path}:`, error);
            statusElement.textContent = "Não foi possível carregar esta leitura.";
            updateConnectionStatus();
        },
    );
}

onValue(
    ledRef,
    (snapshot) => {
        connectedSensors.add("Sensor/LED");
        failedSensors.delete("Sensor/LED");

        if (!snapshot.exists()) {
            ledState = false;
            ledAvailable = true;
            ledStatus.textContent = "LED desligado.";
        } else if (typeof snapshot.val() === "boolean") {
            ledState = snapshot.val();
            ledAvailable = true;
            ledStatus.textContent = ledState ? "LED ligado." : "LED desligado.";
        } else {
            ledAvailable = false;
            ledStatus.textContent = "Estado inválido em /Sensor/LED. Esperado true ou false.";
        }

        updateLedControl();
        updateConnectionStatus();
    },
    (error) => {
        failedSensors.add("Sensor/LED");
        connectedSensors.delete("Sensor/LED");
        ledAvailable = false;
        updateLedControl();
        console.error("Não foi possível ler Sensor/LED:", error);
        ledStatus.textContent = "Não foi possível carregar o estado do LED.";
        updateConnectionStatus();
    },
);

ledToggle.addEventListener("click", async () => {
    if (!ledAvailable || ledUpdating) {
        return;
    }

    ledUpdating = true;
    updateLedControl();
    ledStatus.textContent = "Atualizando LED...";

    try {
        const result = await runTransaction(ledRef, (currentValue) => {
            if (currentValue === null) {
                return true;
            }
            return typeof currentValue === "boolean" ? !currentValue : undefined;
        });

        if (!result.committed) {
            ledStatus.textContent = "Não foi possível alterar: o valor no Firebase não é booleano.";
        }
    } catch (error) {
        console.error("Não foi possível atualizar Sensor/LED:", error);
        ledStatus.textContent = "Erro ao atualizar o LED. Verifique a conexão e as regras do banco.";
    } finally {
        ledUpdating = false;
        updateLedControl();
    }
});

listenToSensor("Sensor/Temperatura", temperatureValue, temperatureStatus);
listenToSensor("Sensor/Umidade", humidityValue, humidityStatus);
