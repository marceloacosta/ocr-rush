# OCR Rush

A free Build With AWS architecture game. [Play at marcelops.com](https://www.marcelops.com/ocr-rush/).

Six levels explore document processing on Amazon EKS, separate EC2 GPU pools, Redis, and selectable S3/SQS variations. Compare delivery times, estimated USD costs and recovery behavior, then share a reproducible challenge. Throughput is simulated and costs use pinned reference prices; this is not an AWS benchmark or a complete production bill.

The game runs entirely in the browser. Newsletter signup uses the official Build With AWS Substack embed directly on the landing page, with a note explaining that signup may open another tab. The Play the free game button appears after 8 seconds; playing does not require a subscription. No modal opens on arrival. Progress is saved locally in the player's browser.

## Companion article

[Read the companion article](https://www.marcelops.com/ocr-rush/article/): **Can you get 10,000 invoices processed on time?** It introduces the document-processing task and the six levels, recommends The Neural Maze course, and ends with a link to play.

The [Substack export page](https://www.marcelops.com/ocr-rush/article/substack.html) provides separate copy controls for the title, subtitle and formatted body. An editable Word document and a diagram PNG are downloadable there. Body copy preserves headings and links; upload the diagram separately if including it. No Substack post or email is sent by this page.

Locally, open `/article/` or `/article/substack.html`. Keep the HTML and Markdown text in sync when editing. Regenerate the Word document with `python3 export-article.py` (requires `python-docx` and `beautifulsoup4`). The static site uses the generated document and has no Python runtime dependency. Run `node test/article-export.mjs` for local copy/paste checks or add `--live` to check the public export page.

## Sharing results

Every result link carries the exact configuration, including failed attempts. Opening it loads that design; only passing results become cost targets. Copy link, copy post text and download image are separate actions. Native sharing includes the PNG when supported, with a link-only fallback. Editing a design requires a fresh run before sharing it. Local previews create links to the public game.

The game and article have separate illustrated 1200 × 630 preview images and explicit Open Graph/X metadata. Regenerate the images with `node render-social-cards.mjs`. The reference pricing region is documented in the model assumptions rather than promoted in the game controls or results summary.

Run `node test/browser.mjs --sharing-only` to check result reopening, saved-design precedence, clipboard/downloads, mobile share payloads, cancellation and fallback behavior. Native destinations are not contacted by the tests.

## Local development

Use Node 22 or newer. The app has no runtime dependencies.

```sh
npm run dev
```

Open http://localhost:4174. Install the development dependencies with `npm ci` to run browser checks, which also require Google Chrome.

## Verification and deployment

```sh
npm test
npm run build
npm run test:deployment
node test/deployment.mjs --live
```

The deployment check exercises the built files at the production path before publishing. The live check verifies the public game and reads the Substack form without submitting an email.

Pushing to `main` runs `.github/workflows/deploy.yml`: tests, static build, upload and GitHub Pages deployment. The project inherits `www.marcelops.com` from the account's existing user site. No separate CNAME or DNS change is needed. `PUBLIC_URL` can override the full HTTPS deployment URL when building for another host. Roll back by reverting a commit and running the same workflow.

Only `dist/` is served. There is no backend, AWS account requirement or runtime cloud deployment. Metadata and challenge URLs include the `/ocr-rush/` path.

## Attribution

Original game, graphics and simulation by Build With AWS. Inspired by [The Neural Maze's production OCR course and AWS implementation](https://theneuralmaze.substack.com/p/deploying-a-production-ocr-system). This is not an official adaptation, endorsement or performance benchmark. No article illustrations or upstream application source were copied.
