export type DirectoryKind = `claude-${string}`;
export type DirectoryEntry = {
  slug: string; name: string; group: string; help: string;
  source: string; openUrl: string; server?: string; publisher?: string; icon?: string;
};
// Featured sections from https://claude.com/marketplace/connectors-plugins, plus the two Google Workspace servers.
export const directory: DirectoryEntry[] = [
  {"slug": "google-drive", "icon": "google-drive.svg", "name": "Google Drive", "group": "Konektor populer", "help": "Cari dan baca berkas di Drive.", "source": "https://claude.com/marketplace/connectors/google-drive", "openUrl": "https://claude.ai/directory/b89f7865-a755-4f86-8062-c3bd651740ce", "server": "https://drivemcp.googleapis.com/mcp/v1", "publisher": "Google"},
  {"slug": "gmail", "icon": "gmail.svg", "name": "Gmail", "group": "Konektor populer", "help": "Cari email dan siapkan draf balasan.", "source": "https://claude.com/marketplace/connectors/gmail", "openUrl": "https://claude.ai/directory/2701e52f-b826-4aaf-8b25-11f2a97c98b0", "server": "https://gmailmcp.googleapis.com/mcp/v1", "publisher": "Google"},
  {"slug": "google-calendar", "icon": "google-calendar.svg", "name": "Google Calendar", "group": "Konektor populer", "help": "Lihat jadwal dan kelola acara.", "source": "https://claude.com/marketplace/connectors/google-calendar", "openUrl": "https://claude.ai/directory/2a838eaa-f7b4-4bc2-bd47-c326f3c813c5", "server": "https://calendarmcp.googleapis.com/mcp/v1", "publisher": "Google"},
  {"slug": "canva", "icon": "canva.jpg", "name": "Canva", "group": "Konektor populer", "help": "Cari dan kerjakan desain Canva.", "source": "https://claude.com/marketplace/connectors/canva", "openUrl": "https://claude.ai/directory/eb9240f2-e1c1-43c1-828f-0fda40c22e4c", "server": "https://mcp.canva.com/mcp", "publisher": "Canva"},
  {"slug": "notion", "icon": "notion.svg", "name": "Notion", "group": "Konektor populer", "help": "Telusuri dan perbarui halaman workspace.", "source": "https://claude.com/marketplace/connectors/notion", "openUrl": "https://claude.ai/directory/69f3a300-cc60-48c4-b237-dfac56530dbf", "server": "https://mcp.notion.com/mcp", "publisher": "Notion"},
  {"slug": "microsoft-365", "icon": "microsoft-365.svg", "name": "Microsoft 365", "group": "Konektor populer", "help": "Akses Outlook, Teams, dan SharePoint.", "source": "https://claude.com/marketplace/connectors/microsoft-365", "openUrl": "https://claude.ai/directory/ce0c9cda-5ea5-44c5-9cf2-40810dfa6582", "server": "https://microsoft365.mcp.claude.com/mcp", "publisher": "Anthropic"},
  {"slug": "figma", "icon": "figma.jpg", "name": "Figma", "group": "Konektor populer", "help": "Gunakan konteks desain dari Figma.", "source": "https://claude.com/marketplace/connectors/figma", "openUrl": "https://claude.ai/directory/c758d038-d8eb-4421-b426-9dd68dc7f84a", "server": "https://mcp.figma.com/mcp", "publisher": "Figma"},
  {"slug": "slack", "icon": "slack.svg", "name": "Slack", "group": "Konektor populer", "help": "Cari percakapan dan kerjakan pesan Slack.", "source": "https://claude.com/marketplace/connectors/slack", "openUrl": "https://claude.ai/directory/597f662f-36de-437e-836e-5a81013cbfbe", "server": "https://mcp.slack.com/mcp", "publisher": "Slack"},
  {"slug": "atlassian", "icon": "atlassian.jpg", "name": "Atlassian MCP", "group": "Konektor populer", "help": "Telusuri Jira dan Confluence.", "source": "https://claude.com/marketplace/connectors/atlassian", "openUrl": "https://claude.ai/directory/11ba10d9-477b-4988-bd1c-90a7fa680dc1", "server": "https://mcp.atlassian.com/v2/mcp", "publisher": "Atlassian"},
  {"slug": "hubspot", "icon": "hubspot.jpg", "name": "HubSpot", "group": "Konektor populer", "help": "Gunakan data kontak dan aktivitas CRM.", "source": "https://claude.com/marketplace/connectors/hubspot", "openUrl": "https://claude.ai/directory/875dee50-9b3f-452b-af8c-fbc839966273", "server": "https://mcp.hubspot.com/anthropic", "publisher": "HubSpot"},
  {"slug": "asana", "icon": "asana.jpg", "name": "Asana", "group": "Konektor populer", "help": "Kelola tugas dan proyek tim.", "source": "https://claude.com/marketplace/connectors/asana", "openUrl": "https://claude.ai/directory/41aefcf3-a829-45eb-8cee-d90b93912f57", "server": "https://mcp.asana.com/v2/mcp", "publisher": "Asana"},
  {"slug": "linear", "icon": "linear.svg", "name": "Linear", "group": "Konektor populer", "help": "Telusuri dan perbarui issue proyek.", "source": "https://claude.com/marketplace/connectors/linear", "openUrl": "https://claude.ai/directory/fa50c30c-9f62-4f94-b851-217868185db6", "server": "https://mcp.linear.app/mcp", "publisher": "Linear (Linear Orbit, Inc.)"},
  {"slug": "google-docs", "name": "Google Docs", "group": "Google Workspace", "help": "Baca dan sunting dokumen Google.", "source": "https://developers.google.com/workspace/docs/api/guides/configure-mcp-server", "openUrl": "https://claude.ai/settings/connectors", "server": "https://docsmcp.googleapis.com/mcp/v1", "publisher": "Google"},
  {"slug": "google-sheets", "name": "Google Sheets", "group": "Google Workspace", "help": "Baca dan perbarui data spreadsheet.", "source": "https://developers.google.com/workspace/sheets/api/guides/configure-mcp-server", "openUrl": "https://claude.ai/settings/connectors", "server": "https://sheetsmcp.googleapis.com/mcp/v1", "publisher": "Google"},
  {"slug": "frontend-design", "name": "Frontend Design", "group": "Plugin Claude Code", "help": "Rancang dan implementasikan antarmuka web.", "source": "https://claude.com/marketplace/plugins/frontend-design", "openUrl": "https://claude.com/marketplace/plugins/frontend-design"},
  {"slug": "superpowers", "name": "Superpowers", "group": "Plugin Claude Code", "help": "Gunakan alur pengembangan, debugging, dan pengujian.", "source": "https://claude.com/marketplace/plugins/superpowers", "openUrl": "https://claude.com/marketplace/plugins/superpowers"},
  {"slug": "code-review", "name": "Code Review", "group": "Plugin Claude Code", "help": "Tinjau perubahan kode pada pull request.", "source": "https://claude.com/marketplace/plugins/code-review", "openUrl": "https://claude.com/marketplace/plugins/code-review"},
  {"slug": "context7", "name": "Context7", "group": "Plugin Claude Code", "help": "Cari dokumentasi pustaka terkini.", "source": "https://claude.com/marketplace/plugins/context7", "openUrl": "https://claude.com/marketplace/plugins/context7"},
  {"slug": "code-simplifier", "name": "Code Simplifier", "group": "Plugin Claude Code", "help": "Sederhanakan kode sambil mempertahankan perilakunya.", "source": "https://claude.com/marketplace/plugins/code-simplifier", "openUrl": "https://claude.com/marketplace/plugins/code-simplifier"},
  {"slug": "playwright", "name": "Playwright", "group": "Plugin Claude Code", "help": "Uji interaksi browser dengan Playwright.", "source": "https://claude.com/marketplace/plugins/playwright", "openUrl": "https://claude.com/marketplace/plugins/playwright"},
];
export const customKind = "claude-custom";
export const customEntry:DirectoryEntry = {
  slug:"custom",name:"Konektor MCP kustom",group:"Konektor kustom",
  help:"Gunakan server MCP melalui HTTPS.",source:"https://modelcontextprotocol.io/",openUrl:"https://claude.ai/settings/connectors"
};
export const directoryByKind = new Map<string,DirectoryEntry>(
  [...directory,customEntry].map(entry=>["claude-"+entry.slug,entry])
);
export function validServer(value:string) {
  try {
    const url=new URL(value);
    return url.protocol==="https:" && !url.username && !url.password && !url.hash &&
      !Array.from(url.searchParams.keys()).some(k=>/(?:token|secret|passw|api[-_]?key|credential|^key$|^auth$)/i.test(k)) && value.length<=400;
  } catch { return false; }
}
