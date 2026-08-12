import type { FC, ReactNode } from "react";

export interface MarkdownLinkProps {
  href?: string;
  children?: ReactNode;
}

interface AssistantChatProps {
  assistantName?: string;
  className?: string;
  emptyState?: {
    slotHeading?: ReactNode;
    slotSubheading?: ReactNode;
  };
  messageContentProps?: {
    markdownLinkComponent?: FC<MarkdownLinkProps>;
  };
  onRunningChange?: (running: boolean) => void;
  placeholder?: string;
  slotComposerStart?: ReactNode;
}

export const AssistantChat: FC<AssistantChatProps> = ({
  assistantName = "Assistant",
  className,
  messageContentProps,
  placeholder,
  slotComposerStart,
}) => {
  const Citation = messageContentProps?.markdownLinkComponent;

  return (
    <div className={`demo-chat ${className ?? ""}`}>
      <div className="demo-chat-thread">
        <div className="demo-message demo-message-user">
          Why did the first test attempt fail?
        </div>
        <div className="demo-message demo-message-assistant">
          <div className="demo-assistant-name">{assistantName}</div>
          <p>
            The first attempt retried every exception, including a validation
            error that should have failed immediately. The fix narrowed the
            retry boundary to transient transport failures.
          </p>
          <p className="demo-citations">
            Evidence: {Citation ? (
              <Citation href="#zoomer-node=phase-diagnose">diagnosis</Citation>
            ) : (
              "diagnosis"
            )}{" "}
            · {Citation ? (
              <Citation href="#zoomer-node=tool-patch">retry patch</Citation>
            ) : (
              "retry patch"
            )}
          </p>
        </div>
      </div>
      <div className="demo-chat-composer">
        <div className="demo-starters">{slotComposerStart}</div>
        <div className="demo-textarea-row">
          <textarea aria-label="Task prompt" placeholder={placeholder} />
          <button type="button" aria-label="Send message">↑</button>
        </div>
      </div>
    </div>
  );
};
