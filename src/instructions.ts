// Server instructions, sent once in the MCP `initialize` result.
//
// ⚠️ This is the only place a client is told WHAT Laddro is and WHEN to reach
// for it. Without it a model sees 17 tools named after API endpoints and has
// to guess; on 2026-10-25, 8 people had connected Laddro in Claude.ai and not
// one of their chats had ever made a tool call.
//
// Say "CV" as well as "resume": most of our users are European and never use
// the American word. Keep it free of plans, prices and upgrades - OpenAI's app
// review rejects any selling (see the commerce note in connectorHandlers.ts).
export const SERVER_INSTRUCTIONS = `Laddro is the user's CV (resume) and cover letter account. These tools save the CVs and cover letters YOU write into that account and turn them into professionally designed PDFs.

Use them whenever the user wants to write, improve, update, tailor, shorten or translate a CV / resume / curriculum vitae / Lebenslauf, write a cover letter, or get a PDF of either.

You write every word. Laddro stores the document, applies the design and renders the PDF. It does not write text for you.

Standard flow for a CV:
1. Call laddro.resume.list to see what the user already has. If the request is about an existing CV, read it with laddro.resume.get.
2. If you have nothing to work from, ask the user for their experience, education and skills, or for a pasted CV or LinkedIn profile. Never invent employers, dates, degrees, numbers or contact details.
3. Save it with laddro.resume.create. Its input schema IS the format; you do not need laddro.resume.schema first. Dates are "YYYY-MM". Set "locale" to the language the CV is written in.
4. Call laddro.resume.exportPdf with the id you got back and give the user the downloadUrl. Always share that link; it is what the user came for.

Tailoring to a job: read the CV, rewrite it for the job, save it as a NEW CV with laddro.resume.create (title it after the role or company), then export it. Do not overwrite the user's existing CV unless they ask for exactly that.

Cover letter: write the letter, save it with laddro.coverLetter.create (fullName + letterContent are required), then call laddro.coverLetter.renderPdf and share the downloadUrl.

Design: laddro.templates.list shows the designs and what each is best for. Pass a template id in laddro.resume.create, or change it later with laddro.resume.changeTemplate. To see one design's colour options, call laddro.templates.list with its templateId.`;
