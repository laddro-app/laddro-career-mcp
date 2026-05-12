import { Laddro } from "@laddro/career-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function createHandlers(client: Laddro) {
  return async (name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
    switch (name) {
      case "laddro_list_templates": {
        const templates = await client.templates.list();
        return json(templates);
      }
      case "laddro_get_template": {
        const detail = await client.templates.get(args.templateId as string);
        return json(detail);
      }
      case "laddro_list_fonts": {
        const fonts = await client.templates.fonts();
        return json(fonts);
      }
      case "laddro_list_languages": {
        const languages = await client.templates.languages();
        return json(languages);
      }
      case "laddro_list_models": {
        const models = await client.templates.models();
        return json(models);
      }
      case "laddro_list_resumes": {
        const list = await client.resumes.list({
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        });
        return json(list);
      }
      case "laddro_get_resume": {
        const resume = await client.resumes.get(args.resumeId as string);
        return json(resume);
      }
      case "laddro_render_resume": {
        const pdf = await client.resumes.render(args.resumeId as string, {
          templateId: args.templateId as string,
          locale: args.locale as string | undefined,
          colorId: args.colorId as string | undefined,
          font: args.font as string | undefined,
          spacing: args.spacing as number | undefined,
          margin: args.margin as number | undefined,
          fontSize: args.fontSize as number | undefined,
          pageNumbering: args.pageNumbering as any,
        });
        return binary(pdf, "application/pdf");
      }
      case "laddro_tailor_resume": {
        const pdf = await client.tailor.run({
          resumeId: args.resumeId as string | undefined,
          positionName: args.positionName as string,
          jobDescription: args.jobDescription as string | undefined,
          jobUrl: args.jobUrl as string | undefined,
          mode: args.mode as any,
          language: args.language as string | undefined,
          includeCoverLetter: args.includeCoverLetter as boolean | undefined,
          templateId: args.templateId as string | undefined,
          colorId: args.colorId as string | undefined,
          font: args.font as string | undefined,
        });
        const mimeType = args.includeCoverLetter ? "application/zip" : "application/pdf";
        return binary(pdf, mimeType);
      }
      case "laddro_export_resume": {
        const pdf = await client.export.pdf({
          resumeId: args.resumeId as string,
          templateId: args.templateId as string | undefined,
          locale: args.locale as string | undefined,
          colorId: args.colorId as string | undefined,
          font: args.font as string | undefined,
          spacing: args.spacing as number | undefined,
          margin: args.margin as number | undefined,
          fontSize: args.fontSize as number | undefined,
          pageNumbering: args.pageNumbering as any,
        });
        return binary(pdf, "application/pdf");
      }
      case "laddro_list_cover_letters": {
        const list = await client.coverLetters.list({
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        });
        return json(list);
      }
      case "laddro_get_cover_letter": {
        const cl = await client.coverLetters.get(args.coverLetterId as string);
        return json(cl);
      }
      case "laddro_create_cover_letter": {
        const result = await client.coverLetters.create({
          title: args.title as string | undefined,
          fullName: args.fullName as string,
          jobTitle: args.jobTitle as string | undefined,
          address: args.address as string | undefined,
          email: args.email as string | undefined,
          phone: args.phone as string | undefined,
          companyName: args.companyName as string | undefined,
          hiringManager: args.hiringManager as string | undefined,
          letterContent: args.letterContent as string,
        });
        return json(result);
      }
      case "laddro_generate_cover_letter": {
        const pdf = await client.coverLetters.generate({
          resumeId: args.resumeId as string | undefined,
          positionName: args.positionName as string,
          jobDescription: args.jobDescription as string | undefined,
          jobUrl: args.jobUrl as string | undefined,
          language: args.language as string | undefined,
          templateId: args.templateId as string | undefined,
          colorId: args.colorId as string | undefined,
          font: args.font as string | undefined,
        });
        return binary(pdf, "application/pdf");
      }
      case "laddro_render_cover_letter": {
        const pdf = await client.coverLetters.render(args.coverLetterId as string, {
          templateId: args.templateId as string,
          locale: args.locale as string | undefined,
          colorId: args.colorId as string | undefined,
          font: args.font as string | undefined,
          spacing: args.spacing as number | undefined,
          margin: args.margin as number | undefined,
          fontSize: args.fontSize as number | undefined,
          pageNumbering: args.pageNumbering as any,
        });
        return binary(pdf, "application/pdf");
      }
      case "laddro_get_settings": {
        const settings = await client.settings.get();
        return json(settings);
      }
      case "laddro_update_ai_model": {
        const result = await client.settings.updateModel({
          provider: args.provider as string,
          model: args.model as string | undefined,
          apiKey: args.apiKey as string,
        });
        return json(result);
      }
      case "laddro_delete_ai_model": {
        const result = await client.settings.deleteModel();
        return json(result);
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  };
}

function json(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function binary(data: ArrayBuffer, mimeType: string): CallToolResult {
  const base64 = Buffer.from(data).toString("base64");
  return {
    content: [{
      type: "resource",
      resource: {
        uri: `data:${mimeType};base64,${base64}`,
        mimeType,
        blob: base64,
      },
    }],
  };
}
