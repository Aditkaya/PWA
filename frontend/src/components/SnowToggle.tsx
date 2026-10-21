import { Snowflake } from 'lucide-react'
import { useSnowStore } from '../store/snow.store'
import { useLangStore } from '../store/lang.store'
import '../styles/snowfall.css'

export default function SnowToggle({ inMenu = false }: { inMenu?: boolean }) {
  const { enabled, toggle } = useSnowStore()
  const lang = useLangStore(state => state.lang)
  return (
    <button type="button" className={`pwa-snow-toggle${inMenu ? ' pwa-snow-toggle--menu' : ''}`} onClick={toggle} aria-pressed={enabled}>
      <Snowflake size={18} aria-hidden="true" />
      <span>{lang === 'id' ? 'Efek salju' : 'Snow effect'}: {lang === 'id' ? (enabled ? 'Aktif' : 'Mati') : (enabled ? 'On' : 'Off')}</span>
    </button>
  )
}
