import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Maximize2, MessageCircle, Minimize2, Send, Sparkles, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ChatMessage from './ChatMessage';
import { useAuth } from '../context/AuthContext';
import { chatbotAPI } from '../services/api';

const ROLE_ASSISTANT_CONFIG = {
  iqac_admin: {
    eyebrow: 'IQAC Assistant',
    title: 'Jorvis AI',
    description: 'Institution-wide analytics, reports, year-wise filters, and accreditation guidance.',
    scope: 'Institutional analytics',
    placeholder:
      'Ask about reports, departments, students, placements, accreditation, or year-wise insights...',
    welcomeTitle: 'Ask Jorvis about institutional quality data.',
    welcomeText:
      'Use natural language for reports, rankings, counts, comparisons, and year-wise analysis across departments, students, placements, research, and accreditation records.',
    prompts: [
      'Show placement report for CSE',
      'Top 10 students with backlog in 2024 batch',
      'Research publication report for 2024',
      'Which department has best placement percentage',
    ],
    routeContexts: [
      {
        prefixes: ['/placements'],
        scope: 'Placement analytics',
        description: 'Placement trends, packages, recruiter mix, and placement report generation.',
        placeholder: 'Ask about top placements, package trends, recruiters, or department placement reports...',
        prompts: [
          'Top 50 placements report',
          'Which department has best placement percentage',
          'Placement report for 2024',
          'Top recruiters by hires',
        ],
      },
      {
        prefixes: ['/reports'],
        scope: 'Report generation',
        description: 'Generate structured reports, exports, charts, and ranked filtered summaries.',
        placeholder: 'Ask for a student, placement, faculty, document, or accreditation report...',
        prompts: [
          'Student progress report for CSE',
          'Research publication report for 2024',
          'Accreditation summary report',
          'Top 20 faculty contribution report',
        ],
      },
      {
        prefixes: ['/naac', '/nba', '/documents'],
        scope: 'Accreditation workspace',
        description: 'NAAC, NBA, documents, evidence readiness, and compliance tracking.',
        placeholder: 'Ask about NAAC/NBA status, pending documents, criteria readiness, or evidence counts...',
        prompts: [
          'NAAC documents for criteria 3',
          'NBA criteria status for CSE',
          'Pending accreditation documents',
          'Institutional audit readiness report',
        ],
      },
    ],
  },
  hod: {
    eyebrow: 'Department Assistant',
    title: 'Jorvis AI',
    description: 'Department-level insights for students, faculty, placements, and accreditation readiness.',
    scope: 'Department monitoring',
    placeholder: 'Ask about department performance, faculty, placements, or student trends...',
    welcomeTitle: 'Ask Jorvis about your department performance.',
    welcomeText:
      'Use natural language to compare outcomes, generate department reports, review placements, and monitor student performance trends.',
    prompts: [
      'Department performance report',
      'Which department has best placement percentage',
      'Top 10 students in CSE',
      'Faculty achievements in ECE',
    ],
    routeContexts: [
      {
        prefixes: ['/faculty', '/research'],
        scope: 'Faculty and research',
        description: 'Track faculty outputs, achievements, publications, and contribution patterns.',
        placeholder: 'Ask about faculty achievements, publications, experience, or contribution reports...',
        prompts: [
          'Top faculty by publications',
          'Faculty contribution report',
          'Research publications in CSE',
          'Faculty achievements in ECE',
        ],
      },
      {
        prefixes: ['/students', '/student-progress'],
        scope: 'Student monitoring',
        description: 'Track student batches, backlogs, attendance, performance, and departmental comparisons.',
        placeholder: 'Ask about backlogs, attendance, CGPA trends, or batch-wise student performance...',
        prompts: [
          '2024 CSE students with backlog',
          'Top 10 students in CSE',
          'Attendance below 75 in CSE',
          'Student progress report for department',
        ],
      },
    ],
  },
  staff: {
    eyebrow: 'Operations Assistant',
    title: 'Jorvis AI',
    description: 'Operational support for records, reports, documentation, and quality workflow follow-up.',
    scope: 'Records and reports',
    placeholder: 'Ask about student records, reports, departments, or document status...',
    welcomeTitle: 'Ask Jorvis about records and reporting.',
    welcomeText:
      'Use Jorvis to retrieve records, count filtered data, prepare reports, and monitor documentation or departmental activity.',
    prompts: [
      'Count 2024 students',
      'Student records for CSE',
      'Department report',
      'Pending documents',
    ],
    routeContexts: [
      {
        prefixes: ['/staff-dashboard/reports'],
        scope: 'Staff reporting',
        description: 'Generate operational reports and filtered data summaries for staff workflows.',
        placeholder: 'Ask for department, student, or documentation reports...',
        prompts: [
          'Backlog analysis report',
          'Student progress report',
          'Department summary report',
          'Placement report',
        ],
      },
      {
        prefixes: ['/staff-dashboard/documents'],
        scope: 'Documentation tracking',
        description: 'Track uploads, pending approvals, and accreditation-related documentation.',
        placeholder: 'Ask about documents, pending approvals, or accreditation evidence counts...',
        prompts: [
          'Pending accreditation documents',
          'Documents uploaded in 2024',
          'Count NAAC documents',
          'Documentation summary report',
        ],
      },
    ],
  },
  faculty: {
    eyebrow: 'Faculty Assistant',
    title: 'Jorvis AI',
    description: 'Subject, student, research, and contribution support tailored to faculty workflows.',
    scope: 'Faculty workspace',
    placeholder: 'Ask about your subjects, students, research, documents, or contribution reports...',
    welcomeTitle: 'Ask Jorvis about your faculty workspace.',
    welcomeText:
      'Use Jorvis to explore subject outcomes, student performance, achievements, research outputs, and documents from one assistant panel.',
    prompts: [
      'Subject pass percentage for semester 5',
      'My students with backlog',
      'Research publication report for 2024',
      'Faculty contribution report',
    ],
    routeContexts: [
      {
        prefixes: ['/faculty/workspace/subjects'],
        scope: 'Subject outcomes',
        description: 'Analyze pass percentages, semester outcomes, and subject performance trends.',
        placeholder: 'Ask about subject pass percentage, semester trends, or student outcomes...',
        prompts: [
          'Subject pass percentage for semester 5',
          'Compare subject performance by semester',
          'Students failing in my subjects',
          'Semester-wise performance trend',
        ],
      },
      {
        prefixes: ['/faculty/workspace/students'],
        scope: 'Student support',
        description: 'Track performance, backlog, attendance, and at-risk learners.',
        placeholder: 'Ask about students with backlog, attendance issues, or top performers...',
        prompts: [
          'Students with backlog',
          'Attendance below 75',
          'Top 10 students',
          'At risk students report',
        ],
      },
      {
        prefixes: ['/faculty/workspace/contributions', '/research'],
        scope: 'Research and contributions',
        description: 'Review publications, achievements, research output, and faculty contribution summaries.',
        placeholder: 'Ask about publications, achievements, research counts, or contribution reports...',
        prompts: [
          'Count publications in 2024',
          'Research publication report for 2024',
          'Faculty achievements report',
          'Top faculty by publications',
        ],
      },
      {
        prefixes: ['/faculty/workspace/documents'],
        scope: 'Faculty documents',
        description: 'Track uploaded documents, evidence, and contribution-related files.',
        placeholder: 'Ask about uploaded documents, pending approvals, or evidence summaries...',
        prompts: [
          'My uploaded documents',
          'Pending document approvals',
          'Count research documents',
          'Document summary report',
        ],
      },
    ],
  },
  student: {
    eyebrow: 'Student Assistant',
    title: 'Jorvis AI',
    description: 'Personal academic guidance for performance, attendance, backlogs, documents, and placements.',
    scope: 'Student self-service',
    placeholder: 'Ask about your performance, attendance, backlogs, documents, or placement readiness...',
    welcomeTitle: 'Ask Jorvis about your student progress.',
    welcomeText:
      'Use Jorvis to understand attendance, backlog status, semester trends, achievements, placements, and document-related updates in simple language.',
    prompts: [
      'Show my attendance trend',
      'Do I have any current backlogs',
      'Placement readiness summary',
      'My uploaded documents',
    ],
    routeContexts: [
      {
        prefixes: ['/student-dashboard/subjects'],
        scope: 'Academic subjects',
        description: 'Understand subject outcomes, semester progress, and academic performance trends.',
        placeholder: 'Ask about your semester subjects, marks, or performance trends...',
        prompts: [
          'Show my semester subjects',
          'My subject performance trend',
          'Which subject needs improvement',
          'Semester wise performance',
        ],
      },
      {
        prefixes: ['/student-dashboard/attendance'],
        scope: 'Attendance tracking',
        description: 'Check attendance patterns, warnings, and semester-level attendance summaries.',
        placeholder: 'Ask about your attendance percentage, warnings, or attendance trend...',
        prompts: [
          'Show my attendance trend',
          'Is my attendance below 75',
          'Attendance by semester',
          'Attendance summary report',
        ],
      },
      {
        prefixes: ['/student-dashboard/backlogs'],
        scope: 'Backlog support',
        description: 'Review current backlogs, risk indicators, and academic recovery status.',
        placeholder: 'Ask about your current backlogs, risk level, or backlog history...',
        prompts: [
          'Do I have any current backlogs',
          'Backlog analysis report',
          'Current backlogs by semester',
          'Am I at risk academically',
        ],
      },
      {
        prefixes: ['/student-dashboard/documents'],
        scope: 'Student documents',
        description: 'Track your uploaded documents, pending approvals, and evidence files.',
        placeholder: 'Ask about your documents, upload status, or pending approvals...',
        prompts: [
          'My uploaded documents',
          'Pending document approvals',
          'Document status summary',
          'How many documents have I uploaded',
        ],
      },
      {
        prefixes: ['/student-dashboard/placements'],
        scope: 'Placement readiness',
        description: 'Check placement eligibility, readiness, and placement-related information.',
        placeholder: 'Ask about placement readiness, opportunities, or placement summary...',
        prompts: [
          'Placement readiness summary',
          'Am I eligible for placements',
          'My placement opportunities',
          'Placement status report',
        ],
      },
    ],
  },
};

const resolveAssistantContext = (role = 'iqac_admin', pathname = '/dashboard') => {
  const fallback = ROLE_ASSISTANT_CONFIG.iqac_admin;
  const baseConfig = ROLE_ASSISTANT_CONFIG[role] || fallback;
  const routeOverride = (baseConfig.routeContexts || []).find((routeConfig) =>
    (routeConfig.prefixes || []).some((prefix) => pathname.startsWith(prefix))
  );

  return {
    ...baseConfig,
    ...routeOverride,
  };
};

const formatTime = (date = new Date()) =>
  date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

const buildMessage = (sender, text, extra = {}) => ({
  id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sender,
  text,
  timestamp: formatTime(),
  type: extra.type || 'text',
  title: extra.title || null,
  summaryText: extra.summaryText || '',
  rows: extra.rows || [],
  summary: extra.summary || {},
  tables: extra.tables || [],
  reportCharts: extra.reportCharts || null,
  tableRows: extra.tableRows || [],
  exportTableRows: extra.exportTableRows || [],
  insights: extra.insights || null,
  chart: extra.chart || null,
  meta: extra.meta || null,
  presentation: extra.presentation || null,
  answerCard: extra.answerCard || null,
  reportPayload: extra.reportPayload || null,
  structuredPayload: extra.structuredPayload || null,
  rawMessage: extra.rawMessage || text,
  status: extra.status || 'default',
});

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const extractErrorMessage = async (error, fallbackMessage) => {
  const directMessage = error.response?.data?.error;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  const blobPayload = error.response?.data;
  if (typeof Blob !== 'undefined' && blobPayload instanceof Blob) {
    try {
      const text = (await blobPayload.text()).trim();
      if (!text) {
        return fallbackMessage;
      }

      try {
        const parsed = JSON.parse(text);
        const parsedMessage = parsed.error || parsed.message;
        if (typeof parsedMessage === 'string' && parsedMessage.trim()) {
          return parsedMessage.trim();
        }
      } catch {
        return text;
      }
    } catch {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
};

const isInteractiveStructuredMessage = (message = {}) =>
  message.type === 'report' ||
  message.type === 'insight' ||
  message.presentation?.variant === 'answer_card' ||
  Boolean(message.answerCard) ||
  message.type === 'count';

export default function JorvisChat({
  isOpen = false,
  onOpenChange = () => {},
}) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [focusedMessage, setFocusedMessage] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const assistantContext = useMemo(
    () => resolveAssistantContext(user?.role, location.pathname),
    [location.pathname, user?.role]
  );

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, focusedMessage, isFocusMode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    textareaRef.current?.focus();
  }, [isOpen, isFocusMode]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setIsFocusMode(false);
    setFocusedMessage(null);
  }, [isOpen]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input, isOpen]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (focusedMessage) {
        setFocusedMessage(null);
        return;
      }

      if (isFocusMode) {
        setIsFocusMode(false);
        return;
      }

      if (isOpen) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [focusedMessage, isFocusMode, isOpen, onOpenChange]);

  const closeAssistant = () => {
    setFocusedMessage(null);
    setIsFocusMode(false);
    onOpenChange(false);
  };

  const handleExport = async (message, format) => {
    const exportPrompt = message.rawMessage || message.text || message.title || 'generate report';

    try {
      const response = await chatbotAPI.exportReport(
        message.reportPayload
          ? {
              message: exportPrompt,
              format,
              reportData: message.reportPayload,
            }
          : exportPrompt,
        format
      );
      downloadBlob(response.data, `jorvis-report.${format === 'docx' ? 'docx' : 'pdf'}`);
    } catch (error) {
      const fallbackMessage = `I could not export the ${format.toUpperCase()} report right now.`;
      const resolvedMessage = await extractErrorMessage(error, fallbackMessage);

      setMessages((current) => [
        ...current,
        buildMessage('bot', resolvedMessage, {
          title: 'Export Error',
          status: 'error',
        }),
      ]);
    }
  };

  const handleInsightExport = async (message) => {
    try {
      const response = await chatbotAPI.exportInsight({
        message: message.rawMessage || message.title || 'insight report',
        title: message.title || message.insights?.title || 'Insight Report',
        summaryText: message.summaryText || message.text || '',
        insights: message.insights,
        chart: message.chart,
      });

      downloadBlob(response.data, 'jorvis-insight-report.pdf');
    } catch (error) {
      const fallbackMessage = 'I could not export the insight report right now.';
      const resolvedMessage = await extractErrorMessage(error, fallbackMessage);

      setMessages((current) => [
        ...current,
        buildMessage('bot', resolvedMessage, {
          title: 'Export Error',
          status: 'error',
        }),
      ]);
    }
  };

  const sendMessage = async (explicitMessage = null) => {
    const trimmedMessage = String(explicitMessage ?? input).trim();
    if (!trimmedMessage || isSending) {
      return;
    }

    setMessages((current) => [...current, buildMessage('user', trimmedMessage)]);
    setInput('');
    setIsSending(true);

    try {
      const response = await chatbotAPI.chat(trimmedMessage);
      const payload = response.data || {};
      const isRecommendationPayload =
        payload.intent === 'recommendation' &&
        Array.isArray(payload.insights) &&
        Array.isArray(payload.recommendations);
      const isQueryRoutingPayload =
        (payload.route === 'local' || payload.route === 'llm') &&
        typeof payload.reason === 'string' &&
        typeof payload.confidence === 'number';
      const isQueryPlanPayload =
        typeof payload.entity === 'string' &&
        typeof payload.intent === 'string' &&
        typeof payload.primary_table === 'string' &&
        Array.isArray(payload.joins) &&
        Array.isArray(payload.filters) &&
        Array.isArray(payload.fields_required);
      const isReportPlanPayload =
        (payload.type === 'report' || payload.type === 'data') &&
        (typeof payload.entity === 'string' || payload.entity === null) &&
        payload.filters &&
        typeof payload.filters === 'object' &&
        !Array.isArray(payload.filters) &&
        (payload.sort === null ||
          (payload.sort &&
            typeof payload.sort === 'object' &&
            !Array.isArray(payload.sort))) &&
        (typeof payload.limit === 'number' || payload.limit === null) &&
        !('intent' in payload) &&
        !('primary_table' in payload) &&
        !('report_structure' in payload);
      const isQueryParameterPayload =
        (typeof payload.entity === 'string' || payload.entity === null) &&
        payload.filters &&
        typeof payload.filters === 'object' &&
        !Array.isArray(payload.filters) &&
        (payload.sort === null ||
          (payload.sort &&
            typeof payload.sort === 'object' &&
            !Array.isArray(payload.sort))) &&
        (typeof payload.limit === 'number' || payload.limit === null) &&
        typeof payload.hasFilters === 'boolean' &&
        !('type' in payload) &&
        !('intent' in payload) &&
        !('primary_table' in payload) &&
        !('report_structure' in payload);
      const isFormattedReportPayload =
        payload.type === 'report' &&
        typeof payload.title === 'string' &&
        payload.summary &&
        typeof payload.summary === 'object' &&
        !Array.isArray(payload.summary) &&
        Array.isArray(payload.charts) &&
        Array.isArray(payload.table);
      const isStructuredJsonPayload =
        isQueryRoutingPayload ||
        isRecommendationPayload ||
        isQueryPlanPayload ||
        isReportPlanPayload ||
        isQueryParameterPayload;

      const replyText = isFormattedReportPayload
        ? payload.title.trim() || 'Report'
        : typeof payload.reply === 'string' && payload.reply.trim()
          ? payload.reply.trim()
          : isStructuredJsonPayload
            ? JSON.stringify(payload, null, 2)
            : 'I received the request, but no reply was returned by the server.';

      setMessages((current) => [
        ...current,
        buildMessage('bot', replyText, {
          type: isFormattedReportPayload
            ? 'report'
            : isStructuredJsonPayload
              ? 'text'
              : payload.type || 'text',
          title: payload.title || null,
          summaryText:
            typeof payload.summary === 'string' ? payload.summary : payload.summaryText || '',
          rows: Array.isArray(payload.rows) ? payload.rows : [],
          summary:
            isFormattedReportPayload
              ? payload.summary
              : payload.summaryData ||
                (payload.summary &&
                typeof payload.summary === 'object' &&
                !Array.isArray(payload.summary)
                  ? payload.summary
                  : {}),
          tables: Array.isArray(payload.tables) ? payload.tables : [],
          reportCharts: isFormattedReportPayload ? payload.charts : null,
          tableRows:
            isFormattedReportPayload && Array.isArray(payload.table) ? payload.table : [],
          exportTableRows:
            isFormattedReportPayload && Array.isArray(payload.exportTable)
              ? payload.exportTable
              : [],
          insights: payload.insights || null,
          chart: payload.chart || null,
          meta: payload.meta || null,
          presentation: payload.presentation || null,
          answerCard: payload.answerCard || null,
          reportPayload: isFormattedReportPayload ? payload : null,
          structuredPayload: isStructuredJsonPayload ? payload : null,
          rawMessage: trimmedMessage,
        }),
      ]);
    } catch (error) {
      const serverMessage = error.response?.data?.error;
      const fallbackMessage =
        typeof serverMessage === 'string' && serverMessage.trim()
          ? serverMessage
          : 'I could not reach the chatbot service right now. Please try again in a moment.';

      setMessages((current) => [
        ...current,
        buildMessage('bot', fallbackMessage, {
          title: 'Response Error',
          status: 'error',
        }),
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handlePromptSelect = async (prompt) => {
    await sendMessage(prompt);
  };

  const handleAnswerAction = (action) => {
    if (!action || action.type !== 'navigate' || !action.path) {
      return;
    }

    navigate(action.path, action.state ? { state: action.state } : undefined);
  };

  const renderTypingRow = () => (
    <div className="flex items-start gap-3 py-2">
      <div className="jorvis-avatar-shell mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
        <Bot size={18} />
      </div>
      <div className="jorvis-status-row inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
        <Sparkles size={14} className="animate-pulse" />
        <span>Jorvis is thinking...</span>
      </div>
    </div>
  );

  const renderAssistantContent = ({ focusMode = false } = {}) => (
    <>
      <div className="jorvis-panel-header px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="jorvis-avatar-shell flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[rgb(var(--color-content-muted))]">
                {assistantContext.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[rgb(var(--color-content-primary))]">
                {assistantContext.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[rgb(var(--color-content-secondary))]">
                {assistantContext.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFocusMode((current) => !current)}
              className="btn-secondary flex h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold"
              aria-label={focusMode ? 'Return chatbot to docked mode' : 'Open chatbot in focus mode'}
            >
              {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="hidden sm:inline">{focusMode ? 'Dock' : 'Focus'}</span>
            </button>

            <button
              type="button"
              onClick={closeAssistant}
              className="btn-secondary h-11 w-11 p-0"
              aria-label="Close Jorvis assistant"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="jorvis-status-pill">Online</span>
          <span className="jorvis-status-pill jorvis-status-pill--accent">
            {focusMode ? 'Focus mode' : assistantContext.scope}
          </span>
        </div>
      </div>

      <div
        className="jorvis-panel-thread flex-1 overflow-y-auto px-4 py-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Jorvis chat messages"
      >
        <div className="flex flex-col gap-1">
          {!messages.length ? (
            <div className="jorvis-welcome-card rounded-[28px] p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[rgb(var(--color-content-muted))]">
                Welcome
              </p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight text-[rgb(var(--color-content-primary))]">
                {assistantContext.welcomeTitle}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[rgb(var(--color-content-secondary))]">
                {assistantContext.welcomeText}
              </p>

              <div className="mt-5 grid gap-3">
                {assistantContext.prompts.map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => handlePromptSelect(prompt)}
                    disabled={isSending}
                    className="jorvis-prompt-card rounded-2xl px-4 py-3 text-sm font-medium text-[rgb(var(--color-content-primary))]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              compact={!focusMode}
              onExport={(format) => handleExport(message, format)}
              onInsightExport={() => handleInsightExport(message)}
              onAnswerAction={handleAnswerAction}
              onFocusMessage={
                isInteractiveStructuredMessage(message) ? () => setFocusedMessage(message) : null
              }
            />
          ))}

          {isSending ? renderTypingRow() : null}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="jorvis-panel-composer px-4 py-4 sm:px-5">
        <div className="jorvis-composer-shell rounded-[28px] p-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={assistantContext.placeholder}
            className="jorvis-input-field w-full resize-none border-0 bg-transparent px-1 py-1 text-[15px] leading-6 outline-none"
            aria-label="Type your message for Jorvis"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-[rgb(var(--color-content-muted))]">
              Press Enter to send. Shift + Enter for a new line.
            </p>

            <button
              type="button"
              onClick={sendMessage}
              disabled={isSending || !input.trim()}
              className="btn-primary h-12 min-w-[3.25rem] rounded-2xl px-5 disabled:translate-y-0"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={[
          'jorvis-launcher fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300',
          isOpen ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
        ].join(' ')}
        aria-label="Open Jorvis assistant"
      >
        <MessageCircle size={24} />
      </button>

      <div
        className={`fixed inset-0 z-20 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen && !isFocusMode ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeAssistant}
        aria-hidden="true"
      />

      {!isFocusMode ? (
        <aside
          className={[
            'jorvis-panel-shell fixed inset-0 z-30 flex flex-col transition-all duration-300',
            'lg:inset-y-4 lg:right-4 lg:left-auto lg:w-[27rem] lg:rounded-[32px]',
            isOpen
              ? 'translate-x-0 opacity-100'
              : 'pointer-events-none translate-y-full opacity-0 lg:translate-y-0 lg:translate-x-[110%]',
          ].join(' ')}
          aria-hidden={!isOpen}
        >
          {renderAssistantContent()}
        </aside>
      ) : null}

      {isOpen && isFocusMode ? (
        <div className="jorvis-focus-backdrop fixed inset-0 z-40 p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Jorvis assistant focus mode"
            className="jorvis-focus-shell flex h-full w-full flex-col overflow-hidden sm:rounded-[34px]"
          >
            {renderAssistantContent({ focusMode: true })}
          </div>
        </div>
      ) : null}

      {focusedMessage ? (
        <div
          className="jorvis-focus-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          onClick={() => setFocusedMessage(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${focusedMessage.title || 'Jorvis response'} expanded view`}
            className="jorvis-focus-shell flex h-full w-full flex-col overflow-hidden sm:h-[92vh] sm:max-w-6xl sm:rounded-[34px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="jorvis-focus-header flex items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[rgb(var(--color-content-muted))]">
                  Focus View
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-[rgb(var(--color-content-primary))]">
                  {focusedMessage.title || 'Expanded Jorvis response'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setFocusedMessage(null)}
                className="btn-secondary h-11 w-11 p-0"
                aria-label="Close focused view"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="mx-auto max-w-5xl">
                <ChatMessage
                  message={focusedMessage}
                  onExport={(format) => handleExport(focusedMessage, format)}
                  onInsightExport={() => handleInsightExport(focusedMessage)}
                  onAnswerAction={handleAnswerAction}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
