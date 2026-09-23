# OCR Rush

A free Build With AWS architecture game. [Play at marcelops.com](https://www.marcelops.com/ocr-rush/).

Six levels explore document processing on Amazon EKS, separate EC2 GPU pools, Redis, and selectable S3/SQS variations. Compare delivery times, estimated USD costs and recovery behavior, then share a reproducible challenge. Throughput is simulated and costs use pinned reference prices; this is not an AWS benchmark or a complete production bill.

The game runs entirely in the browser. Newsletter signup uses the official Build With AWS Substack embed directly on the landing page, with a note explaining that signup may open another tab. The Play the free game button appears after 8 seconds; playing does not require a subscription. No modal opens on arrival. Progress is saved locally in the player's browser.

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
