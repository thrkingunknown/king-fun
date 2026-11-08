import './hero-motion.css'
import { Icon } from './components/ui/Icon.tsx'

/** Lightweight CSS illustration for the home hero. */
export function HeroMotion() {
  return <div className="chaos-art" role="img" aria-label="KING-FUN game tokens">
    <div className="chaos-orbit chaos-orbit-a" />
    <div className="chaos-orbit chaos-orbit-b" />
    <div className="chaos-spark chaos-spark-a"><Icon name="sparkles" size={18} /></div>
    <div className="chaos-spark chaos-spark-b"><Icon name="sparkles" size={13} /></div>
    <div className="chaos-core-wrap">
      <div className="chaos-core">
        <span className="die-dot die-dot-a" /><span className="die-dot die-dot-b" />
        <span className="die-dot die-dot-c" /><span className="die-dot die-dot-d" />
        <span className="die-dot die-dot-e" />
      </div>
      <span className="chaos-core-glow" />
    </div>
    <div className="chaos-token chaos-token-violet"><Icon name="venetian-mask" size={24} /></div>
    <div className="chaos-token chaos-token-orange"><Icon name="drama" size={24} /></div>
    <div className="chaos-token chaos-token-pink"><Icon name="dices" size={24} /></div>
    <div className="chaos-token chaos-token-mint"><Icon name="hand" size={24} /></div>
  </div>
}
