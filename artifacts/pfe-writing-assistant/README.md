# PFE Writing Assistant

Local writing assistant for improving PFE report paragraphs while preserving the technical meaning.

## Run With Ollama

Install Ollama, then pull a model:

```powershell
ollama pull llama3.1
```

Start the app:

```powershell
pnpm --filter @devops-observatory/pfe-writing-assistant dev
```

Open:

```text
http://localhost:5178
```

## Optional Environment Variables

```powershell
$env:PORT="5178"
$env:PFE_AI_PROVIDER="ollama"
$env:OLLAMA_URL="http://localhost:11434"
$env:OLLAMA_MODEL="llama3.1"
```

## OpenAI-Compatible Mode

```powershell
$env:PFE_AI_PROVIDER="openai"
$env:OPENAI_API_KEY="your_api_key"
$env:OPENAI_MODEL="gpt-4o-mini"
pnpm --filter @devops-observatory/pfe-writing-assistant dev
```

You can also use another OpenAI-compatible API by setting:

```powershell
$env:OPENAI_BASE_URL="https://your-provider.example/v1"
```
