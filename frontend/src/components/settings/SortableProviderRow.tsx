import { Icon } from '../ui/Icon.tsx'

type Provider = 'gemini' | 'groq'
type Props = {
  provider: Provider
  index: number
  status: string
  hasKey: boolean
  enabled: boolean
  isDragging: boolean
  onEdit: () => void
  onTest: () => void
  onRemove: () => void
  onToggle: (enabled: boolean) => void
  onMove: (direction: -1 | 1) => void
  onDragStart: (provider: Provider) => void
  onDrop: (provider: Provider) => void
  onDragEnd: () => void
}

/** Provider row with native pointer drag-and-drop and explicit keyboard reorder controls. */
export function SortableProviderRow({ provider, index, status, hasKey, enabled, isDragging, onEdit, onTest, onRemove, onToggle, onMove, onDragStart, onDrop, onDragEnd }: Props) {
  const name = provider === 'gemini' ? 'Google Gemini' : 'Groq'
  return <div
    className={`ai-provider-row kf-provider-row ${isDragging ? 'is-dragging' : ''}`}
    role="listitem"
    aria-roledescription="sortable provider"
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
    onDrop={event => { event.preventDefault(); onDrop(provider) }}
  >
    <button
      type="button"
      className="provider-drag-handle"
      draggable
      aria-label={`Drag ${name} to reorder. Use the move up and move down buttons for keyboard reordering.`}
      onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', provider); onDragStart(provider) }}
      onDragEnd={onDragEnd}
    ><Icon name="grip" size={17} /></button>
    <span className="ai-provider-rank">{String(index + 1).padStart(2, '0')}</span>
    <div className="provider-identity"><strong className="provider-name" id={`provider-name-${provider}`}>{name}</strong><span id={`provider-status-${provider}`} className={`provider-connection ${hasKey ? 'is-connected' : 'is-idle'}`}><i />{status}</span></div>
    <div className="provider-actions">
      <button type="button" className="setting-action" aria-haspopup="dialog" aria-controls="ai-key-dialog" onClick={onEdit}><Icon name="key" size={14} /> Key settings</button>
      <button type="button" className="setting-action" disabled={!hasKey} title="Runs one small generation request and may consume provider quota" onClick={onTest}><Icon name="activity" size={14} /> Test</button>
      <button type="button" className="provider-order-button" disabled={index === 0} aria-label={`Move ${name} up`} onClick={() => onMove(-1)}><Icon name="arrow-up" size={15} /></button>
      <button type="button" className="provider-order-button" disabled={index === 1} aria-label={`Move ${name} down`} onClick={() => onMove(1)}><Icon name="arrow-down" size={15} /></button>
      {hasKey && <button type="button" className="provider-order-button is-remove" aria-label={`Remove ${name} API key`} onClick={onRemove}><Icon name="trash" size={15} /></button>}
    </div>
    <button
      type="button"
      className={`kf-switch provider-toggle ${enabled ? 'is-on' : ''}`}
      role="switch"
      aria-labelledby={`provider-name-${provider} provider-toggle-state-${provider}`}
      aria-describedby={`provider-status-${provider}`}
      aria-checked={enabled}
      disabled={!hasKey}
      onClick={() => onToggle(!enabled)}
    >
      <span className="kf-switch-track" aria-hidden="true"><span className="kf-switch-thumb">{enabled ? <Icon name="check" size={10} strokeWidth={2.8} /> : null}</span></span>
      <span id={`provider-toggle-state-${provider}`} className="kf-switch-state">{enabled ? 'ON' : 'OFF'}</span>
    </button>
  </div>
}
