import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match inline code, bold, italic, or markdown links
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          className="font-mono text-[0.87em] px-1.5 py-0.5 rounded bg-[#F1F4F9] dark:bg-[#202D43] text-[#111827] dark:text-[#F8FAFC] border border-[#E6EAF0] dark:border-[#2B3950]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && isSafeHttpUrl(linkMatch[2])) {
        nodes.push(
          <a
            key={`a-${keyIdx++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4563FF] underline underline-offset-2 hover:opacity-80"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <div
          key={`code-${blockKey++}`}
          className="my-3 rounded-xl overflow-hidden border border-[#E6EAF0] dark:border-[#2B3950] bg-[#101827] text-[#F8FAFC]"
        >
          {lang && (
            <div className="px-3.5 py-1.5 text-[11px] font-mono text-[#A7B2C5] border-b border-[#2B3950] bg-[#182338]">
              {lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown table
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
      const headerCells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        bodyRows.push(rowCells);
        i++;
      }
      blocks.push(
        <div key={`tbl-${blockKey++}`} className="my-3 overflow-x-auto rounded-xl border border-[#E6EAF0] dark:border-[#2B3950]">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-[#F7F9FC] dark:bg-[#202D43]">
              <tr>
                {headerCells.map((cell, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 font-semibold text-[#111827] dark:text-[#F8FAFC] border-b border-[#E6EAF0] dark:border-[#2B3950]"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#F7F9FC]/60 dark:hover:bg-[#202D43]/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-[#111827] dark:text-[#E2E8F0] align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const cls =
        level === 1
          ? 'text-lg font-bold mt-4 mb-2 text-[#111827] dark:text-[#F8FAFC]'
          : level === 2
            ? 'text-base font-semibold mt-4 mb-1.5 text-[#111827] dark:text-[#F8FAFC]'
            : 'text-sm font-semibold mt-3 mb-1 text-[#111827] dark:text-[#F8FAFC]';
      blocks.push(
        <div key={`h-${blockKey++}`} className={cls}>
          {renderInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${blockKey++}`} className="my-3 border-[#E6EAF0] dark:border-[#2B3950]" />);
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${blockKey++}`}
          className="my-2.5 px-3.5 py-2.5 rounded-xl bg-[#F7F9FC] dark:bg-[#202D43] border border-[#E6EAF0] dark:border-[#2B3950] text-sm text-[#667085] dark:text-[#A7B2C5]"
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="my-2 space-y-1.5 pl-5 list-disc marker:text-[#4563FF]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="my-2 space-y-1.5 pl-5 list-decimal marker:text-[#4563FF] marker:font-medium">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('> ')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p-${blockKey++}`} className="my-1.5 leading-relaxed">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className={`text-[15px] leading-relaxed break-words ${className}`}>{blocks}</div>;
};
