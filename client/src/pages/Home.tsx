import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Copy,
  Clipboard,
  Settings,
  ChevronDown,
  Plus,
  Save,
  FileText,
  Grid3x3,
  BarChart3,
  Filter,
  MessageSquare,
  Type,
  Zap,
  Eye,
  ZoomIn,
  Share2,
  BookOpen,
  Layers,
  Maximize,
  Download,
  Upload,
  Play,
  Trash2,
  Send,
  Menu,
  X,
  Home as HomeIcon,
  ChevronRight,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

/**
 * Kenyan SACCO IDE - Meridian AI Premium Design
 * 
 * Design Philosophy:
 * - Clean, minimalist interface
 * - Modern color palette (deep navy, accent blue, white)
 * - Smooth animations and transitions
 * - Premium financial software aesthetic
 * - Streamlined ribbon with smart grouping
 * - Professional typography hierarchy
 */

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFile, setSelectedFile] = useState('Trial Balance - January 2026');
  const [fileType, setFileType] = useState('excel');
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [agentMessages, setAgentMessages] = useState([
    {
      type: 'agent',
      text: 'Hey! I\'m your SACCO AI. Upload messy data and I\'ll clean it, detect issues, and generate SASRA reports.',
      timestamp: new Date(),
    },
  ]);
  const [agentInput, setAgentInput] = useState('');

  const handleFileSelect = (file: string, type: string) => {
    setSelectedFile(file);
    setFileType(type);
  };

  const handleSendMessage = () => {
    if (agentInput.trim()) {
      setAgentMessages([
        ...agentMessages,
        { type: 'user', text: agentInput, timestamp: new Date() },
      ]);
      setAgentInput('');
      setTimeout(() => {
        setAgentMessages((prev) => [
          ...prev,
          {
            type: 'agent',
            text: 'Found 3 issues: phantom savings in member 1245, inconsistent dates, missing references. Fix automatically?',
            timestamp: new Date(),
          },
        ]);
      }, 800);
    }
  };

  const RibbonButton = ({ icon: Icon, label, onClick, size = 'sm' }: any) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors group"
      title={label}
    >
      <Icon className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
      <span className="text-xs text-slate-500 group-hover:text-slate-700 text-center max-w-12 leading-tight">
        {label}
      </span>
    </button>
  );

  const RibbonGroup = ({ title, children }: any) => (
    <div className="flex flex-col items-center gap-2 px-3 py-2 border-r border-slate-200">
      <div className="flex gap-0.5">{children}</div>
      <span className="text-xs text-slate-500 font-medium">{title}</span>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
      {/* Premium Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
            SI
          </div>
          <h1 className="text-sm font-semibold text-slate-900">SACCO IDE</h1>
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Search files..."
            className="w-48 bg-slate-100 border-0 text-sm placeholder:text-slate-400 focus:bg-white"
          />
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-600 hover:text-blue-600 hover:bg-blue-50"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </div>

      {/* Modern Ribbon Menu */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 overflow-x-auto shadow-sm">
        <div className="flex items-center gap-1 mb-2">
          {['home', 'insert', 'layout', 'formulas', 'data', 'view'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'layout' ? 'Page Layout' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Ribbon Content */}
        {activeTab === 'home' && (
          <div className="flex gap-0.5 pb-2">
            <RibbonGroup title="Clipboard">
              <RibbonButton icon={Clipboard} label="Paste" />
              <RibbonButton icon={Copy} label="Copy" />
            </RibbonGroup>
            <RibbonGroup title="Font">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1">
                    Calibri <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white border-slate-200">
                  <DropdownMenuItem>Arial</DropdownMenuItem>
                  <DropdownMenuItem>Times New Roman</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <RibbonButton icon={Bold} label="Bold" />
              <RibbonButton icon={Italic} label="Italic" />
              <RibbonButton icon={Underline} label="Underline" />
            </RibbonGroup>
            <RibbonGroup title="Alignment">
              <RibbonButton icon={AlignLeft} label="Left" />
              <RibbonButton icon={AlignCenter} label="Center" />
              <RibbonButton icon={AlignRight} label="Right" />
            </RibbonGroup>
            <RibbonGroup title="Tools">
              <RibbonButton icon={Filter} label="Filter" />
              <RibbonButton icon={BarChart3} label="Chart" />
              <RibbonButton icon={Zap} label="Audit" />
            </RibbonGroup>
          </div>
        )}

        {activeTab === 'insert' && (
          <div className="flex gap-0.5 pb-2">
            <RibbonGroup title="Pages">
              <RibbonButton icon={Plus} label="Page" />
            </RibbonGroup>
            <RibbonGroup title="Tables">
              <RibbonButton icon={Grid3x3} label="Table" />
            </RibbonGroup>
            <RibbonGroup title="Charts">
              <RibbonButton icon={BarChart3} label="Chart" />
            </RibbonGroup>
            <RibbonGroup title="Media">
              <RibbonButton icon={Upload} label="Upload" />
            </RibbonGroup>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="flex gap-0.5 pb-2">
            <RibbonGroup title="Data">
              <RibbonButton icon={Upload} label="Import" />
              <RibbonButton icon={Filter} label="Filter" />
              <RibbonButton icon={Trash2} label="Clean" />
            </RibbonGroup>
            <RibbonGroup title="Analysis">
              <RibbonButton icon={BarChart3} label="Analyze" />
              <RibbonButton icon={TrendingUp} label="Trends" />
            </RibbonGroup>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Modern */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          {/* User Profile */}
          <div className="p-6 border-b border-slate-200">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold mb-3">
              IG
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Ian Gicheha</h2>
            <p className="text-xs text-slate-500 mt-1">SACCO Manager</p>
          </div>

          {/* Directory */}
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
              Recent Files
            </h3>
          </div>

          {/* File List */}
          <ScrollArea className="flex-1">
            <div className="px-4 py-2 space-y-1">
              {[
                { name: 'Trial Balance - January 2026', type: 'excel', icon: Grid3x3 },
                { name: 'M-Pesa Statements', type: 'pdf', icon: FileText },
                { name: 'Member Register', type: 'excel', icon: Grid3x3 },
                { name: 'Loan Listing', type: 'excel', icon: Grid3x3 },
                { name: 'SASRA Form 4', type: 'word', icon: FileText },
                { name: 'Audit Report', type: 'pdf', icon: FileText },
              ].map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFileSelect(file.name, file.type)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    selectedFile === file.name
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <file.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Upload Button */}
          <div className="p-4 border-t border-slate-200">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2">
              <Upload className="w-4 h-4" /> Upload File
            </Button>
          </div>
        </div>

        {/* Center - Premium Document Viewer */}
        <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto p-8 flex items-center justify-center">
          {fileType === 'excel' && (
            <div className="max-w-5xl w-full bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                <h1 className="text-xl font-bold text-white">{selectedFile}</h1>
                <p className="text-blue-100 text-sm mt-1">Financial Data - January 2026</p>
              </div>
              <div className="p-8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Account</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-900">Debit</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-900">Credit</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-900">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { account: 'Cash', debit: '50,000', credit: '0', balance: '50,000' },
                      { account: 'Bank Account', debit: '150,000', credit: '0', balance: '150,000' },
                      { account: 'Member Loans', debit: '500,000', credit: '0', balance: '500,000' },
                      { account: 'Savings Account', debit: '0', credit: '600,000', balance: '600,000' },
                    ].map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                        <td className="py-3 px-4 text-slate-900">{row.account}</td>
                        <td className="text-right py-3 px-4 text-slate-600">{row.debit}</td>
                        <td className="text-right py-3 px-4 text-slate-600">{row.credit}</td>
                        <td className="text-right py-3 px-4 font-semibold text-slate-900">{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fileType === 'pdf' && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">{selectedFile}</p>
              <p className="text-slate-500 text-sm mt-2">PDF Preview</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - AI Agent (Modern) */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">AI Assistant</h3>
            </div>
            <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-900">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {agentMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.type === 'agent' && (
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-xs rounded-lg px-4 py-2 text-sm ${
                      msg.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
              Quick Actions
            </p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs justify-start gap-2">
              <Play className="w-3 h-3" /> Run Audit
            </Button>
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
            >
              <Download className="w-3 h-3" /> Clean Data
            </Button>
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
            >
              <FileText className="w-3 h-3" /> SASRA Form 4
            </Button>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Ask AI..."
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="bg-slate-100 border-0 text-sm placeholder:text-slate-400 focus:bg-white"
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-xs text-slate-500">
        <div>Ready</div>
        <div className="flex items-center gap-4">
          <span>{selectedFile}</span>
          <span className="text-blue-600 font-medium">{fileType.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
