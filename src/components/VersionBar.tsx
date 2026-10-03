import { useRef, useState } from "react";
import { ectsSummary } from "../lib/format";
import type { Course, Version } from "../types";

type VersionBarProps = {
  versions: Version[];
  active: Version;
  selected: Course[];
  compareOpen: boolean;
  onSelect: (versionId: string) => void;
  onCreate: () => void;
  onRename: (versionId: string, name: string) => void;
  onDuplicate: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onToggleCompare: () => void;
};

export function VersionBar({
  versions,
  active,
  selected,
  compareOpen,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onToggleCompare,
}: VersionBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipSave = useRef(false);
  const ects = ectsSummary(selected);
  const canDelete = versions.length > 1;

  function beginRename(version: Version) {
    setDraft(version.name);
    setEditingId(version.id);
  }

  function commitRename(versionId: string) {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    onRename(versionId, draft);
    setEditingId(null);
  }

  function cancelRename() {
    skipSave.current = true;
    setEditingId(null);
  }

  return (
    <div className="version-bar">
      <div className="version-row">
        <div className="version-tabs">
          <div className="version-tablist" role="tablist" aria-label="Timetable versions">
          {versions.map((version) => {
            const selectedTab = version.id === active.id;
            const editing = editingId === version.id;
            return (
              <div key={version.id} className={selectedTab ? "version-tab is-selected" : "version-tab"}>
                {editing ? (
                  <form
                    className="version-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      commitRename(version.id);
                    }}
                  >
                    <label>
                      <span className="visually-hidden">Version name</span>
                      <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        maxLength={48}
                        autoFocus
                        onBlur={() => commitRename(version.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") cancelRename();
                        }}
                      />
                    </label>
                    <button
                      type="submit"
                      className="version-icon"
                      aria-label="Done"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <CheckIcon />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedTab}
                    className="version-tab-label"
                    onClick={() => onSelect(version.id)}
                  >
                    {version.name}
                  </button>
                )}
                {!editing && (
                  <span className="version-tab-actions">
                    <button
                      type="button"
                      className="version-icon"
                      aria-label={`Rename ${version.name}`}
                      onClick={() => beginRename(version)}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className="version-icon"
                      aria-label={`Duplicate ${version.name}`}
                      onClick={() => onDuplicate(version.id)}
                    >
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="version-icon"
                      aria-label={`Delete ${version.name}`}
                      disabled={!canDelete}
                      title={canDelete ? `Delete ${version.name}` : "Keep at least one version"}
                      onClick={() => onDelete(version.id)}
                    >
                      <TrashIcon />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
          </div>
          <button type="button" className="version-create" onClick={onCreate}>
            + New
          </button>
        </div>
        <div className="summary" aria-live="polite">
          <p className="summary-name">{active.name}</p>
          <p>
            {selected.length} {selected.length === 1 ? "Course" : "Courses"}
            {ects ? ` · ${ects}` : ""}
          </p>
        </div>
      </div>
      <div className="version-tools">
        <button
          type="button"
          className={compareOpen ? "is-active" : undefined}
          aria-pressed={compareOpen}
          onClick={onToggleCompare}
          disabled={versions.length < 2}
          title={versions.length < 2 ? "Add another version to compare" : "Compare versions"}
        >
          Compare
        </button>
        <div className="history-actions">
          <button
            type="button"
            className="history-button"
            aria-label="Undo"
            onClick={onUndo}
            disabled={!canUndo}
            title={canUndo ? "Undo the last change" : "Nothing to undo"}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="history-button"
            aria-label="Redo"
            onClick={onRedo}
            disabled={!canRedo}
            title={canRedo ? "Redo the last undone change" : "Nothing to redo"}
          >
            <RedoIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.4 3.7 3.6 6.5l2.8 2.8" />
      <path d="M4 6.5h5.6a2.9 2.9 0 1 1 0 5.8H8.3" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.6 3.7 12.4 6.5l-2.8 2.8" />
      <path d="M12 6.5H6.4a2.9 2.9 0 1 0 0 5.8H7.7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 8.2 6.4 11.4 12.8 4.6" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.4 2.4a1.5 1.5 0 0 1 2.2 2.2L5.2 13.1 2.4 13.6 2.9 10.8 11.4 2.4Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5.5" y="5.5" width="7.2" height="7.2" rx="1.2" />
      <path d="M10.4 5.4V3.6a1.1 1.1 0 0 0-1.1-1.1H3.6a1.1 1.1 0 0 0-1.1 1.1v5.7a1.1 1.1 0 0 0 1.1 1.1h1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.2 4.5h9.6" />
      <path d="M6.3 4.4V3.1h3.4v1.3" />
      <path d="M4.4 4.5l.6 8.1h6l.6-8.1" />
    </svg>
  );
}
