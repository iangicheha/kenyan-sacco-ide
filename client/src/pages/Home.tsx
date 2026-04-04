import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Copy,
  Clipboard,
  Palette,
  Settings,
  ChevronDown,
  Plus,
  Save,
  FileText,
  Folder,
  Grid3x3,
  BarChart3,
  Filter,
  Link as LinkIcon,
  MessageSquare,
  Type,
  Zap,
  Eye,
  Maximize2,
  ZoomIn,
  Share2,
  BookOpen,
  Layers,
  Maximize,
  Download,
  Upload,
  Play,
  Trash2,
  Columns,
  Square,
  Circle,
  Triangle,
  Sigma,
  Send,
  Lightbulb,
} from 'lucide-react';

/**
 * Kenyan SACCO IDE - Professional Microsoft Word-Style Interface
 * 
 * Architecture:
 * - Left: Username + Directory Tree
 * - Top: Title + Ribbon Menu (Home, Insert, Page Layout, Formulas, Data, View, Settings)
 * - Center: Dynamic Content Viewer (Excel, PDF, Word, Text)
 * - Right: AI Agent Sidebar with real-time suggestions
 */

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFile, setSelectedFile] = useState('Trial Balance - January 2026');
  const [fileType, setFileType] = useState('excel');
  const [agentMessages, setAgentMessages] = useState([
    {
      type: 'agent',
      text: 'Hello! I\'m your SACCO AI Assistant. I can help you clean messy data, detect phantom savings, and generate SASRA-compliant reports. What would you like to do?',
    },
  ]);
  const [agentInput, setAgentInput] = useState('');

  const handleFileSelect = (file: string, type: string) => {
    setSelectedFile(file);
    setFileType(type);
  };

  const handleSendMessage = () => {
    if (agentInput.trim()) {
      setAgentMessages([...agentMessages, { type: 'user', text: agentInput }]);
      setAgentInput('');
      setTimeout(() => {
        setAgentMessages((prev) => [
          ...prev,
          {
            type: 'agent',
            text: 'I\'ve analyzed your data. I found 3 issues: phantom savings in member 1245, inconsistent dates in column D, and missing member references. Would you like me to fix these automatically?',
          },
        ]);
      }, 1000);
    }
  };

  // Ribbon Button Component
  const RibbonButton = ({ icon: Icon, label, onClick, dropdown = false }: any) => (
    <div className="flex flex-col items-center gap-1">
      {dropdown ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 p-2 hover:bg-slate-700 rounded transition-colors group">
              <Icon className="w-5 h-5 text-slate-300 group-hover:text-white" />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700">
            <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">Option 1</DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">Option 2</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem className="text-slate-300 hover:bg-slate-700">More Options</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={onClick}
          className="flex flex-col items-center gap-0.5 p-2 hover:bg-slate-700 rounded transition-colors group"
        >
          <Icon className="w-5 h-5 text-slate-300 group-hover:text-white" />
        </button>
      )}
      <span className="text-xs text-slate-400 text-center max-w-12 leading-tight">{label}</span>
    </div>
  );

  // Ribbon Group Component
  const RibbonGroup = ({ title, children }: any) => (
    <div className="flex flex-col items-center gap-2 px-3 py-2 border-r border-slate-600">
      <div className="flex gap-1">{children}</div>
      <span className="text-xs text-slate-500 text-center">{title}</span>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Top Header */}
      <div className="bg-slate-950 border-b border-slate-700 px-6 py-2 flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold text-slate-300">SACCO IDE - Book 1</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white">
            Arrange Split View
          </Button>
          <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white">
            📝 Notes
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Ribbon Menu */}
      <div className="bg-slate-800 border-b border-slate-700">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab List */}
          <TabsList className="bg-slate-750 border-b border-slate-600 w-full justify-start gap-0 rounded-none h-auto p-0">
            {['home', 'insert', 'layout', 'formulas', 'data', 'view', 'settings'].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-4 py-2 text-xs font-medium capitalize border-r border-slate-600"
              >
                {tab === 'layout' ? 'Page Layout' : tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* HOME TAB */}
          <TabsContent value="home" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              {/* Clipboard Group */}
              <RibbonGroup title="Clipboard">
                <RibbonButton icon={Clipboard} label="Paste" dropdown />
                <RibbonButton icon={Copy} label="Copy" />
                <RibbonButton icon={Scissors} label="Cut" />
              </RibbonGroup>

              {/* Font Group */}
              <RibbonGroup title="Font">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 flex items-center gap-1">
                      Calibri <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem className="text-slate-300">Arial</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">Times New Roman</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">Courier New</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 flex items-center gap-1">
                      11 <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem className="text-slate-300">8</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">10</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">12</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">14</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <RibbonButton icon={Bold} label="B" />
                <RibbonButton icon={Italic} label="I" />
                <RibbonButton icon={Underline} label="U" />
              </RibbonGroup>

              {/* Alignment Group */}
              <RibbonGroup title="Alignment">
                <RibbonButton icon={AlignLeft} label="Left" />
                <RibbonButton icon={AlignCenter} label="Center" />
                <RibbonButton icon={AlignRight} label="Right" />
                <RibbonButton icon={AlignJustify} label="Justify" />
              </RibbonGroup>

              {/* Number Group */}
              <RibbonGroup title="Number">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 flex items-center gap-1">
                      Format <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem className="text-slate-300">General</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">Number</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">Currency</DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-300">Percentage</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </RibbonGroup>

              {/* Cells Group */}
              <RibbonGroup title="Cells">
                <RibbonButton icon={Plus} label="Insert" />
                <RibbonButton icon={Trash2} label="Delete" />
                <RibbonButton icon={Settings} label="Format" dropdown />
              </RibbonGroup>

              {/* Paragraph Group */}
              <RibbonGroup title="Paragraph">
                <RibbonButton icon={Columns} label="Indent" />
                <RibbonButton icon={Layers} label="Spacing" />
              </RibbonGroup>

              {/* Styles Group */}
              <RibbonGroup title="Styles">
                <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300">
                  Normal
                </button>
                <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300">
                  Heading 1
                </button>
              </RibbonGroup>

              {/* Editing Group */}
              <RibbonGroup title="Editing">
                <RibbonButton icon={FileText} label="Find" />
                <RibbonButton icon={Settings} label="Replace" />
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* INSERT TAB */}
          <TabsContent value="insert" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              <RibbonGroup title="Pages">
                <RibbonButton icon={Plus} label="Page Break" />
                <RibbonButton icon={FileText} label="Cover" />
              </RibbonGroup>
              <RibbonGroup title="Tables">
                <RibbonButton icon={Grid3x3} label="Table" dropdown />
                <RibbonButton icon={Columns} label="Draw" />
              </RibbonGroup>
              <RibbonGroup title="Illustrations">
                <RibbonButton icon={Maximize} label="Pictures" />
                <RibbonButton icon={Square} label="Shapes" />
                <RibbonButton icon={Lightbulb} label="Icons" />
              </RibbonGroup>
              <RibbonGroup title="Charts">
                <RibbonButton icon={BarChart3} label="Chart" dropdown />
              </RibbonGroup>
              <RibbonGroup title="Sparklines">
                <RibbonButton icon={Zap} label="Line" />
                <RibbonButton icon={BarChart3} label="Column" />
              </RibbonGroup>
              <RibbonGroup title="Media">
                <RibbonButton icon={Play} label="Video" />
                <RibbonButton icon={Volume2} label="Audio" />
              </RibbonGroup>
              <RibbonGroup title="Links">
                <RibbonButton icon={LinkIcon} label="Link" />
              </RibbonGroup>
              <RibbonGroup title="Comments">
                <RibbonButton icon={MessageSquare} label="Comment" />
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* PAGE LAYOUT TAB */}
          <TabsContent value="layout" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              <RibbonGroup title="Page Setup">
                <RibbonButton icon={Settings} label="Margins" dropdown />
                <RibbonButton icon={Maximize} label="Orientation" />
                <RibbonButton icon={Square} label="Size" />
              </RibbonGroup>
              <RibbonGroup title="Paragraph">
                <RibbonButton icon={Columns} label="Indent" />
                <RibbonButton icon={Layers} label="Spacing" />
              </RibbonGroup>
              <RibbonGroup title="Arrange">
                <RibbonButton icon={Layers} label="Bring Forward" />
                <RibbonButton icon={Layers} label="Send Back" />
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* FORMULAS TAB */}
          <TabsContent value="formulas" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              <RibbonGroup title="Function Libraries">
                <RibbonButton icon={Sigma} label="Financial" dropdown />
                <RibbonButton icon={Zap} label="Logical" dropdown />
                <RibbonButton icon={Type} label="Text" dropdown />
              </RibbonGroup>
              <RibbonGroup title="Defined Names">
                <RibbonButton icon={Settings} label="Define" />
              </RibbonGroup>
              <RibbonGroup title="Formula Auditing">
                <RibbonButton icon={Eye} label="Trace" />
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* DATA TAB */}
          <TabsContent value="data" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              <RibbonGroup title="Get & Transform">
                <RibbonButton icon={Upload} label="From File" />
                <RibbonButton icon={Database} label="From DB" />
              </RibbonGroup>
              <RibbonGroup title="Sort & Filter">
                <RibbonButton icon={Filter} label="Sort" />
                <RibbonButton icon={Filter} label="Filter" />
              </RibbonGroup>
              <RibbonGroup title="Data Tools">
                <RibbonButton icon={Columns} label="Text" />
                <RibbonButton icon={Trash2} label="Duplicates" />
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* VIEW TAB */}
          <TabsContent value="view" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              <RibbonGroup title="Views">
                <RibbonButton icon={Eye} label="Normal" />
                <RibbonButton icon={Maximize2} label="Page Break" />
              </RibbonGroup>
              <RibbonGroup title="Zoom">
                <RibbonButton icon={ZoomIn} label="Zoom In" />
                <RibbonButton icon={ZoomIn} label="Zoom Out" />
              </RibbonGroup>
              <RibbonGroup title="Window">
                <RibbonButton icon={Maximize} label="New Window" />
              </RibbonGroup>
            </div>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="mt-0 p-0">
            <div className="bg-slate-750 border-b border-slate-600 px-4 py-3 flex gap-4 overflow-x-auto">
              <RibbonGroup title="Options">
                <RibbonButton icon={Settings} label="General" />
                <RibbonButton icon={Palette} label="Theme" />
              </RibbonGroup>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <p className="text-sm font-semibold text-slate-300">Ian Gicheha</p>
            <p className="text-xs text-slate-500">SACCO Manager</p>
          </div>
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase">Directory</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {[
                { name: 'Trial Balance - January 2026', type: 'excel' },
                { name: 'M-Pesa Statements', type: 'pdf' },
                { name: 'Member Register', type: 'excel' },
                { name: 'Loan Listing', type: 'excel' },
                { name: 'SASRA Form 4', type: 'word' },
                { name: 'Audit Report', type: 'pdf' },
              ].map((file, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs ${
                    selectedFile === file.name
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700'
                  }`}
                  onClick={() => handleFileSelect(file.name, file.type)}
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Center - Document Viewer */}
        <div className="flex-1 bg-slate-900 overflow-auto p-8">
          {fileType === 'excel' && (
            <div className="max-w-6xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold mb-4">{selectedFile}</h1>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-slate-300 px-4 py-2 text-left">Account</th>
                    <th className="border border-slate-300 px-4 py-2 text-right">Debit</th>
                    <th className="border border-slate-300 px-4 py-2 text-right">Credit</th>
                    <th className="border border-slate-300 px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { account: 'Cash', debit: '50,000', credit: '0', balance: '50,000' },
                    { account: 'Bank Account', debit: '150,000', credit: '0', balance: '150,000' },
                    { account: 'Member Loans', debit: '500,000', credit: '0', balance: '500,000' },
                    { account: 'Savings Account', debit: '0', credit: '600,000', balance: '600,000' },
                  ].map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-slate-300 px-4 py-2">{row.account}</td>
                      <td className="border border-slate-300 px-4 py-2 text-right">{row.debit}</td>
                      <td className="border border-slate-300 px-4 py-2 text-right">{row.credit}</td>
                      <td className="border border-slate-300 px-4 py-2 text-right font-semibold">{row.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fileType === 'pdf' && (
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8 h-96 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">{selectedFile}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - AI Agent */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> AI Assistant
            </h3>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
              ⚙️
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {agentMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs rounded-lg px-3 py-2 text-xs ${
                      msg.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-100 border border-slate-600'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <p className="text-xs text-slate-400 font-semibold mb-2">Quick Actions</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs justify-start">
              <Play className="w-3 h-3 mr-2" /> Run Audit
            </Button>
            <Button variant="outline" className="w-full text-slate-300 border-slate-600 hover:bg-slate-700 text-xs justify-start">
              <Download className="w-3 h-3 mr-2" /> Clean Data
            </Button>
            <Button variant="outline" className="w-full text-slate-300 border-slate-600 hover:bg-slate-700 text-xs justify-start">
              <FileText className="w-3 h-3 mr-2" /> SASRA Form 4
            </Button>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <input
              type="text"
              placeholder="Ask the AI..."
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="w-full bg-slate-700 border-slate-600 text-slate-100 text-xs rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Button
              onClick={handleSendMessage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              <Send className="w-3 h-3 mr-2" /> Send
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div>Ready</div>
        <div className="flex items-center gap-4">
          <span>{selectedFile}</span>
          <span>{fileType.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

// Missing icon imports
const Scissors = () => <span>✂️</span>;
const Volume2 = () => <span>🔊</span>;
const Database = () => <span>🗄️</span>;
