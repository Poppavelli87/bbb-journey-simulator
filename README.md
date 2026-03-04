# BBB Consumer Journey Simulator

A lightweight interactive web app that demonstrates the consumer journey of hiring a roofer and how trust signals support more informed decisions.

## Run Locally

1. Open `index.html` in a browser.
2. No installation required.

## Compliance Framing

- The simulator uses qualitative trust framing only (no numeric outcome claims).
- Messaging is educational and mission-aligned with marketplace trust.
- Disclaimer shown in-app:
  - `BBB Accreditation is a signal of a business's commitment to ethical marketplace practices and accountability. BBB does not guarantee outcomes.`

## GitHub Pages Deployment

This is a static site served from the repository root (`/`).

Expected Pages URL format:

- `https://<github-username>.github.io/<repo-name>/`
- Example: `https://poppavelli87.github.io/bbb-journey-simulator/`

Enable Pages in GitHub:

1. Open repository `Settings`.
2. Open `Pages` in the left sidebar.
3. Under `Build and deployment`, set `Source` to `Deploy from a branch`.
4. Set `Branch` to `main` and folder to `/ (root)`.
5. Click `Save`.

## Vercel Deployment

This repo includes `vercel.json` for reliable static hosting behavior.

Vercel UI steps:

1. In Vercel, click `Add New...` -> `Project`.
2. Import the GitHub repository.
3. Framework preset: `Other`.
4. Root Directory: repository root.
5. Build Command: leave empty.
6. Output Directory: leave empty.
7. Click `Deploy`.

Optional CLI deployment:

```bash
vercel deploy -y
```

## Project Structure

```text
bbb-journey-simulator/
  README.md
  index.html
  styles.css
  app.js
  vercel.json
  .github/workflows/deploy-pages.yml
```
