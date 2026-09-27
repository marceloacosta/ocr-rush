# Build with AWS analytics

Production uses GA4 Measurement ID **G-YLB0CNYQ8Z**, shared with marcelops.com,
the churn course, and `buildwithaws.substack.com`. It belongs to property
**Build with AWS** (556133375), web stream 15855031162.

`build.mjs` reads `GA4_MEASUREMENT_ID` and adds `public/analytics.js` to every
built HTML page, including future pages. GitHub Actions supplies the shared
ID, with an optional Actions variable of the same name overriding it. An empty
ID disables injection; malformed nonempty values fail before output is cleared.
The runtime excludes localhost and preview domains.

GA4 initializes once and owns initial and enhanced history page views. Do not
add another tag or send manual page_view events. The runtime is kept identical
to the homepage and course copies; the shared verification suite checks this.

`build_with_aws_click` measures direct publication links, with `page_path`,
`cta_id`, `cta_intent`, `link_domain`, and query-free `link_url` parameters.
Explicit CTA IDs label the header, article closing, gameplay header, and
newsletter fallback links. `newsletter_cta_click` measures opening the
newsletter dialog, with `page_path`, `cta_id`, `cta_intent=subscribe` and
`destination=substack_embed`. Neither event means a subscription completed.

The existing Substack iframe stays intact. A parent page cannot inspect
completion inside that cross-origin iframe; use the direct subscribe fallback
to test the standard top-level cross-domain journey. Native Substack events
must be verified on the actual publication.

Existing UTMs and link destinations are preserved. For ordinary same-tab
publication clicks, a bounded 1000 ms callback allows event dispatch while
Google's click listener decorates the URL. No custom identity is transmitted.

GA4's domain list must contain exact matches for `marcelops.com`,
`www.marcelops.com`, and `buildwithaws.substack.com`; Substack Settings →
Analytics must contain the same **G-YLB0CNYQ8Z**. Use Enhanced Measurement for
page views, scrolls and other outbound clicks, and register `cta_id` and
`cta_intent` as event-scoped custom dimensions when enabling reporting.

Run existing tests with `npm test`. Run `npm run test:deployment` with
`GA4_MEASUREMENT_ID` empty, or intercept GA collection endpoints, to avoid
sending automated test events to production. After deployment verify one
page view, one CTA event, `_gl` decoration, and matching `cid`/`sid` on the
actual Substack destination.
