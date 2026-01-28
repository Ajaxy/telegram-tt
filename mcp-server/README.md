# Telebiz MCP Server

Control Telegram through Claude using MCP (Model Context Protocol). This server connects Claude Desktop or Claude Code to your Telebiz browser session.

## Quick Install

### For Claude Code (Recommended)

```bash
# Install globally
npm install -g @telebiz/telebiz-mcp

# Add to Claude Code
claude mcp add telebiz -- telebiz-mcp
```

### For Claude Desktop

1. Install the package:
   ```bash
   npm install -g @telebiz/telebiz-mcp
   ```

2. Add to your Claude Desktop config:

   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "telebiz": {
         "command": "npx",
         "args": ["-y", "@telebiz/telebiz-mcp"]
       }
     }
   }
   ```

3. Restart Claude Desktop

## Usage

1. **Open Telebiz** in your browser (the MCP server auto-connects)
2. **Ask Claude** to interact with Telegram:
   - "List my unread chats"
   - "Send 'Hello!' to John"
   - "Archive chats older than 30 days"
   - "Search for messages about meeting"
   - "Update the deal stage for this contact"

## Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│  Claude Desktop │◄── stdio ─────────►│   MCP Server    │
│  or Claude Code │                    │   (port 9716)   │
└─────────────────┘                    └────────┬────────┘
                                                │
                                           WebSocket
                                                │
                                       ┌────────▼────────┐
                                       │  Telebiz App    │
                                       │  (Browser)      │
                                       └─────────────────┘
```

## Available Tools

### Telegram (40+ tools)

- **Chat:** listChats, getChatInfo, archiveChat, pinChat, muteChat, deleteChat
- **Messages:** sendMessage, forwardMessages, deleteMessages, searchMessages, getRecentMessages
- **Folders:** listFolders, createFolder, addChatToFolder, removeChatFromFolder
- **Groups:** createGroup, getChatMembers, addChatMembers, removeChatMember
- **Users:** searchUsers, getUserInfo
- **Batch:** batchSendMessage, batchArchive, batchAddToFolder

### Telebiz Core

- **Tasks:** listPendingChats, getChatTasks, dismissTask, snoozeTask
- **CRM:** getChatRelationship

### Extra Tools

- **CRM (HubSpot):** getEntityDetails, updateDealStage, updateEntityField, createContact, createDeal, searchEntities, associateEntities, linkEntityToChat
- **Notion:** getNotionPage, updateNotionBlock, addNotionTodo
- **Reminders:** listReminders, createReminder, completeReminder, deleteReminder
- **Bulk:** bulkArchiveOldChats, bulkMessageChats
- **Skills:** getSkillData, listSkills, createSkill, updateSkill, deleteSkill

## Troubleshooting

### "Telebiz app is not connected"
- Open Telebiz in your browser
- Check browser console for `[MCP Bridge] Connected`

### Port 9716 in use
- Another MCP server instance may be running
- Kill the process: `lsof -ti:9716 | xargs kill -9`

### Claude Code: Check server status
```bash
claude mcp list
/mcp  # Inside Claude Code session
```

### Claude Desktop: Verify config
- Open Settings → Developer → Edit Config
- Ensure the JSON is valid
- Restart Claude Desktop completely

## Development

```bash
# Clone and build
git clone https://github.com/anthropics/telebiz-mcp
cd telebiz-mcp
npm install
npm run build

# Run locally
npm start

# Run tests
npm test
```

## License

GPL-3.0-or-later
