# Running Strix locally (optional)

You do not need this for the GitHub Actions setup — that runs on GitHub's
machines. Use this only if you want to run a scan on your own PC.

## What you need first

1. **Docker Desktop** for Windows — https://www.docker.com/products/docker-desktop/
   Install it, launch it, and wait until it says "Engine running". Strix runs its
   sandbox inside Docker. Docker is not currently installed on your machine.
2. **An LLM API key.** Strix supports OpenAI, Anthropic, OpenRouter, Google
   Vertex, AWS Bedrock, Azure OpenAI, Novita, and local models. It does **not**
   support Groq or NVIDIA NIM, so the keys in your other env files will not work.

## Steps in Git Bash

```bash
# 1. Install the Strix CLI
curl -sSL https://strix.ai/install | bash

# 2. Open a new terminal (or: source ~/.bashrc) so the installer's PATH change applies)

# 3. Point Strix at a model and key
export STRIX_LLM="openrouter/z-ai/glm-5.3"
export LLM_API_KEY="your-key-here"

# 4. Run a scan
strix -n -t https://github.com/VikashMeena777/ChirplyMint-NovaMint \
  --scan-mode quick \
  --instruction-file ./strix.instructions.md \
  --max-budget 10

# 5. Read the results in a local dashboard
strix view
```

Results are written to `strix_runs/<run-name>/` in this folder.

## Exit codes

- `0` — finished, no confirmed vulnerabilities
- `2` — finished, vulnerabilities found
- `1` — fatal error (missing key, Docker not running, bad config)
