const form = document.querySelector("#rewriteForm");
const sourceText = document.querySelector("#sourceText");
const result = document.querySelector("#result");
const message = document.querySelector("#message");
const submitButton = document.querySelector("#submitButton");
const copyButton = document.querySelector("#copyButton");
const providerLabel = document.querySelector("#providerLabel");
const modelLabel = document.querySelector("#modelLabel");
const language = document.querySelector("#language");

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function selectedMode() {
  return new FormData(form).get("mode") ?? "academique";
}

document.querySelectorAll(".mode").forEach((label) => {
  label.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((item) => item.classList.remove("selected"));
    label.classList.add("selected");
  });
});

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    providerLabel.textContent = config.provider === "openai" ? "OpenAI-compatible" : "Ollama local";
    modelLabel.textContent = `Modèle: ${config.model}`;
  } catch {
    providerLabel.textContent = "Configuration indisponible";
    modelLabel.textContent = "Vérifie le serveur local";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = sourceText.value.trim();

  if (!text) {
    setMessage("Colle d'abord un texte à améliorer.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Réécriture en cours...";
  setMessage("Analyse du texte et conservation du sens technique...");

  try {
    const response = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        mode: selectedMode(),
        language: language.value,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }

    result.textContent = data.rewritten;
    result.classList.remove("empty");
    setMessage(`Terminé avec ${data.provider} (${data.model}).`, "success");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Erreur inconnue", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Réécrire le texte";
  }
});

copyButton.addEventListener("click", async () => {
  const text = result.textContent.trim();

  if (!text || result.classList.contains("empty")) {
    setMessage("Aucun résultat à copier.", "error");
    return;
  }

  await navigator.clipboard.writeText(text);
  setMessage("Résultat copié.", "success");
});

loadConfig();
