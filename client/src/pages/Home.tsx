import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Send,
  FileText,
  Folder,
  Settings,
  ChevronRight,
  MessageCircle,
  Play,
  Download,
  Share2,
  Save,
  Undo2,
  Redo2,
  Zap,
} from 'lucide-react';

/**
 * Kenyan SACCO IDE - Meridian-style Document-Centric Layout
 * 
 * Design Philosophy:
 * - Left Pane: File Explorer (Directory structure)
 * - Top: Ribbon Menu (Home, Insert, Page Layout, Formulas, Data, View, Settings)
 * - Center: Document Viewer (Shows actual content/data)
 * - Right Pane: AI Agent Sidebar (Real-time suggestions and actions)
 */

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFile, setSelectedFile] = useState('Trial Balance - January 2026');
  const [agentMessages, setAgentMessages] = useState([
    {
      type: 'agent',
      text: 'Hello! I\'m your SACCO AI Assistant. Upload your trial balance, M-Pesa statements, or loan listings, and I\'ll help you clean the data and generate SASRA-compliant reports.',
    },
  ]);
  const [agentInput, setAgentInput] = useState('');

  const handleSendMessage = () => {
    if (agentInput.trim()) {
      setAgentMessages([...agentMessages, { type: 'user', text: agentInput }]);
      setAgentInput('');
      // Simulate agent response
      setTimeout(() => {
        setAgentMessages((prev) => [
          ...prev,
          {
            type: 'agent',
            text: 'I\'ve analyzed your data. I found 3 potential issues: phantom savings in member ID 1245, inconsistent date formats in column D, and a missing member register reference. Would you like me to fix these?',
          },
        ]);
      }, 1000);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Header with Logo and Quick Actions */}
      <div className="bg-slate-950 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold text-sm">
            SI
          </div>
          <span className="text-sm font-semibold">SACCO IDE - Book 1</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search..."
            className="w-48 bg-slate-800 border-slate-600 text-sm"
          />
          <Button size="sm" variant="outline" className="text-xs">
            Ctrl + Shift + P
          </Button>
        </div>
      </div>

      {/* Ribbon Menu */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent border-b border-slate-600 w-full justify-start gap-8 rounded-none">
            <TabsTrigger
              value="home"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              Home
            </TabsTrigger>
            <TabsTrigger
              value="insert"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              Insert
            </TabsTrigger>
            <TabsTrigger
              value="page-layout"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              Page Layout
            </TabsTrigger>
            <TabsTrigger
              value="formulas"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              Formulas
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              Data
            </TabsTrigger>
            <TabsTrigger
              value="view"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              View
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded px-3 py-1 text-sm"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Home Tab Content */}
          <TabsContent value="home" className="mt-3 flex gap-6">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <Undo2 className="w-4 h-4 mr-1" /> Undo
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <Redo2 className="w-4 h-4 mr-1" /> Redo
              </Button>
            </div>

            <div className="border-l border-slate-600 pl-6 flex items-center gap-2">
              <span className="text-xs text-slate-400">Format:</span>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <Bold className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <Italic className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <Underline className="w-4 h-4" />
              </Button>
            </div>

            <div className="border-l border-slate-600 pl-6 flex items-center gap-2">
              <span className="text-xs text-slate-400">Align:</span>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <AlignLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <AlignCenter className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
                <AlignRight className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Other Tabs */}
          <TabsContent value="insert" className="mt-3 flex gap-4">
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
              <Plus className="w-4 h-4 mr-1" /> Table
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
              <Plus className="w-4 h-4 mr-1" /> Chart
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
              <Plus className="w-4 h-4 mr-1" /> Image
            </Button>
          </TabsContent>

          <TabsContent value="data" className="mt-3 flex gap-4">
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
              Clean Data
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
              Validate
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
              <Zap className="w-4 h-4 mr-1" /> Run Audit
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Explorer */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Directory</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {/* Folder Structure */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-slate-300 hover:text-white cursor-pointer">
                  <Folder className="w-4 h-4 text-blue-400" />
                  <span>Northridge Technologies</span>
                </div>
                <div className="ml-4 space-y-1">
                  <div
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 cursor-pointer"
                    onClick={() => setSelectedFile('Reports')}
                  >
                    <Folder className="w-4 h-4 text-slate-500" />
                    <span>Reports</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    {['2025-09-03-HPEN-JP-...', '2025-09-03-HPEN-JP-...', 'book1.xlsx', 'Screenshot 2025-10-2...'].map(
                      (file, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1 rounded ${
                            selectedFile === file
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                          onClick={() => setSelectedFile(file)}
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate">{file}</span>
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 cursor-pointer">
                    <Folder className="w-4 h-4 text-slate-500" />
                    <span>Research</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Center - Document Viewer */}
        <div className="flex-1 bg-slate-900 overflow-auto p-8">
          <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8">
            {/* Document Header */}
            <div className="mb-8 pb-6 border-b border-slate-200">
              <h1 className="text-3xl font-bold mb-2">Financial Analysis Report</h1>
              <p className="text-sm text-slate-600">Trial Balance - January 2026</p>
            </div>

            {/* Document Content */}
            <div className="space-y-6">
              {/* Summary Section */}
              <div>
                <h2 className="text-xl font-semibold mb-3 text-slate-800">Executive Summary</h2>
                <p className="text-sm text-slate-700 leading-relaxed">
                  This report provides a comprehensive analysis of the SACCO's financial position as of January 2026. Key metrics
                  include revenue trends, cost structure, and profitability analysis across all operational segments.
                </p>
              </div>

              {/* Financial Table */}
              <div>
                <h2 className="text-xl font-semibold mb-3 text-slate-800">Financial Overview</h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border border-slate-300 px-4 py-2 text-left">Metric</th>
                      <th className="border border-slate-300 px-4 py-2 text-right">Actual</th>
                      <th className="border border-slate-300 px-4 py-2 text-right">Projected</th>
                      <th className="border border-slate-300 px-4 py-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: 'Revenue', actual: '$9,370', projected: '$9,555', variance: '$185' },
                      { metric: 'COGS', actual: '($4,977)', projected: '($5,174)', variance: '($197)' },
                      { metric: '% Margin', actual: '53.1%', projected: '54.7%', variance: '1.6%' },
                      { metric: 'Gross Profit', actual: '$4,393', projected: '$4,385', variance: '($8)' },
                    ].map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="border border-slate-300 px-4 py-2 font-medium">{row.metric}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right">{row.actual}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right">{row.projected}</td>
                        <td className="border border-slate-300 px-4 py-2 text-right text-green-600">{row.variance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Key Findings */}
              <div>
                <h2 className="text-xl font-semibold mb-3 text-slate-800">Key Findings</h2>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Revenue exceeded projections by $185K (1.9%)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>Cost of goods sold was controlled within budget</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-yellow-600 font-bold">⚠</span>
                    <span>Gross profit margin slightly below target at 53.1%</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - AI Agent */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Auto Mode
            </h3>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
              ⚙️
            </Button>
          </div>

          {/* Agent Messages */}
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
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs justify-start"
            >
              <Play className="w-3 h-3 mr-2" /> Run Audit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-slate-300 border-slate-600 hover:bg-slate-700 text-xs justify-start"
            >
              <Download className="w-3 h-3 mr-2" /> Clean Data
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-slate-300 border-slate-600 hover:bg-slate-700 text-xs justify-start"
            >
              <FileText className="w-3 h-3 mr-2" /> SASRA Form 4
            </Button>
          </div>

          {/* Agent Input */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <Textarea
              placeholder="Ask the AI agent..."
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              className="bg-slate-700 border-slate-600 text-slate-100 text-xs resize-none h-16"
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
    </div>
  );
}
