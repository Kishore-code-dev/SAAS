import { useState, useEffect, useRef, useMemo } from 'react'
import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { DRIVERS } from '../data/fleetData'
import { X, Layers, Truck, Search, Navigation, Filter, Map as MapIcon, Compass } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const M = '#FF4444'
const G = '#00C896'

const STATUS_COLORS: Record<string, string> = {
  active:  Y,
  idle:    'rgba(255,255,255,0.6)',
  stopped: M,
  offline: 'rgba(255,255,255,0.2)',
}

const DEFAULT_CENTER: [number, number] = [21.5, 79.0]
const DEFAULT_ZOOM = 5

// --- Map Markers ---

const createVehicleIcon = (status: string, reg: string, isSelected: boolean, speed: number, avatar?: string) => {
  const color = STATUS_COLORS[status] || '#888'
  const isMoving = status === 'active' && speed > 0
  
  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        width: ${isSelected ? '44px' : '36px'}; 
        height: ${isSelected ? '44px' : '36px'}; 
        border-radius: 12px;
        background: #111;
        border: 2px solid ${color};
        box-shadow: ${isSelected ? `0 0 20px ${color}80` : '0 4px 10px rgba(0,0,0,0.5)'};
        display: flex; align-items: center; justify-content: center;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
        transform: rotate(45deg);
      ">
        <div style="transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          ${avatar 
            ? `<img src="${avatar}" style="width: 80%; height: 80%; border-radius: 8px; object-fit: cover;" />` 
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10h1"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`
          }
        </div>
        
        ${isMoving ? `
          <div style="
            position: absolute; inset: -4px; border-radius: 14px; 
            border: 2px solid ${color}; opacity: 0.4;
            animation: marker-pulse 2s infinite;
          "></div>
        ` : ''}

        <div style="
          position: absolute; top: -30px; left: 50%; transform: translateX(-50%) rotate(-45deg);
          background: #111; color: white; padding: 2px 8px; border-radius: 6px;
          font-size: 10px; font-weight: 800; border: 1px solid ${color}40;
          white-space: nowrap; pointer-events: none; backdrop-filter: blur(8px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        ">
          ${reg.split(' ')[0]}
        </div>

        ${isMoving ? `
          <div style="
            position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%) rotate(-45deg);
            background: ${color}; color: black; padding: 1px 6px; border-radius: 4px;
            font-size: 9px; font-weight: 900; white-space: nowrap;
          ">${speed} KMH</div>
        ` : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  })
}

// Recenter Component
function RecenterMap({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

export default function LiveMap() {
  const { vehicles, alerts } = useFleet()
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesFilter = filter === 'All' || v.status === filter.toLowerCase()
      const matchesSearch = v.registrationNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           v.model.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [vehicles, filter, searchQuery])

  const selectedV = vehicles.find(v => v.id === selectedId)

  // Auto-center 
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)

  useEffect(() => {
    if (selectedV) {
      setMapCenter([selectedV.location.lat, selectedV.location.lng])
      setMapZoom(14)
    }
  }, [selectedV])

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6 page-enter pb-4">
      
      {/* Map Surface */}
      <div className="flex-1 glass-card rounded-[32px] overflow-hidden relative shadow-premium border-white/5">
        
        {/* Floating Command Bar */}
        <div className="absolute top-6 left-6 right-6 z-[1000] flex items-center justify-between pointer-events-none">
           <div className="flex items-center gap-4 w-full pointer-events-auto">
              <div className="flex-1 max-w-md h-14 glass-card bg-black/60 backdrop-blur-3xl border-white/10 rounded-2xl flex items-center px-5 gap-4 group">
                 <Search className="w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
                 <input 
                    type="text" 
                    placeholder="Search mission hub..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-muted/40 font-bold" 
                 />
                 <div className="h-5 w-px bg-white/10" />
                 <button className="text-muted hover:text-primary transition-colors">
                    <Navigation className="w-5 h-5" />
                 </button>
              </div>

              <div className="flex bg-black/60 backdrop-blur-3xl border border-white/10 p-1.5 rounded-2xl gap-1">
                 {['All', 'Active', 'Idle', 'Stopped'].map(f => (
                   <button 
                     key={f}
                     onClick={() => setFilter(f)}
                     className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-primary text-black shadow-gold' : 'text-muted hover:text-white hover:bg-white/5'}`}
                   >
                     {f}
                   </button>
                 ))}
              </div>
           </div>

           <div className="flex items-center gap-3 pointer-events-auto">
              <div className="glass-card bg-black/60 backdrop-blur-3xl border-white/10 px-4 py-3 flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-gold" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Radar Uplink Active</span>
              </div>
              <button className="w-12 h-12 glass-card bg-black/60 backdrop-blur-3xl border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white">
                 <Compass className="w-6 h-6" />
              </button>
           </div>
        </div>

        {/* The Map */}
        <div className="absolute inset-0 z-0">
          <MapContainer 
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            zoomControl={false}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="map-tiles"
            />
            {/* Google Hybrid Overlay (Optional/Mock) */}
            <TileLayer 
              url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              opacity={0.3}
            />

            <RecenterMap center={mapCenter} zoom={mapZoom} />

            {filteredVehicles.map((v) => {
              const driver = DRIVERS.find(d => d.id === v.driverId)
              const isSelected = selectedId === v.id
              return (
                <Marker 
                  key={v.id} 
                  position={[v.location.lat, v.location.lng]}
                  icon={createVehicleIcon(v.status, v.registrationNo, isSelected, v.speed, driver?.avatar)}
                  eventHandlers={{ click: () => setSelectedId(isSelected ? null : v.id) }}
                >
                  <Popup className="premium-map-popup">
                    <div className="bg-[#111] text-white p-4 w-[240px] border border-white/10 shadow-3xl">
                       <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-4">
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                             {driver?.avatar ? <img src={driver.avatar} className="w-full h-full object-cover" /> : <Truck className="w-6 h-6 text-primary m-3" />}
                          </div>
                          <div>
                             <p className="text-sm font-black tracking-tight">{v.registrationNo}</p>
                             <p className="text-[10px] text-muted font-bold uppercase">{v.model}</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <p className="text-[10px] text-muted uppercase font-black tracking-widest">Pilot</p>
                             <p className="text-xs font-bold truncate">{driver?.name || 'Unassigned'}</p>
                          </div>
                          <div>
                             <p className="text-[10px] text-muted uppercase font-black tracking-widest">Energy</p>
                             <p className="text-xs font-bold transition-colors" style={{ color: v.fuelLevel < 30 ? M : Y }}>{v.fuelLevel}% Level</p>
                          </div>
                          <div className="col-span-2">
                             <p className="text-[10px] text-muted uppercase font-black tracking-widest mb-1">Status</p>
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[v.status] }} />
                                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: STATUS_COLORS[v.status] }}>{v.status}</span>
                             </div>
                          </div>
                       </div>
                       <button className="w-full mt-5 py-3 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-widest shadow-gold">
                          Launch Analysis Drawer
                       </button>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
      </div>

      {/* Side Intelligence Panel */}
      <div className="hidden lg:flex w-80 flex-col gap-6 overflow-y-auto no-scrollbar flex-shrink-0">
        
        {/* Fleet Summary Card */}
        <div className="glass-card p-6 rounded-[24px] border border-white/5 bg-white/[0.02] shadow-premium">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                 <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-white">Fleet Matrix</h3>
                 <p className="text-[9px] font-bold text-muted uppercase tracking-[0.2em] mt-0.5">Tracking {vehicles.length} Assets</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Moving', count: vehicles.filter(v => v.status === 'active' && v.speed > 0).length, color: Y },
                { label: 'Idle', count: vehicles.filter(v => v.status === 'idle').length, color: '#888' },
                { label: 'Critical', count: vehicles.filter(v => v.status === 'stopped' || v.status === 'offline').length, color: M },
                { label: 'Signals', count: alerts.length, color: G },
              ].map((s, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center group hover:border-primary/30 transition-all">
                   <p className="text-2xl font-display font-black mb-1 transition-transform group-hover:scale-110" style={{ color: s.color }}>{s.count}</p>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted opacity-60">{s.label}</p>
                </div>
              ))}
           </div>
        </div>

        {/* Selected Hub Card */}
        <AnimatePresence mode="wait">
          {selectedV ? (
            <motion.div 
              key={selectedV.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-card p-6 rounded-[24px] border border-primary/40 bg-primary/[0.03] shadow-gold relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setSelectedId(null)} className="text-primary hover:text-white transition-colors">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-black border border-primary/20 overflow-hidden shadow-gold">
                      {DRIVERS.find(d => d.id === selectedV.driverId)?.avatar ? (
                        <img src={DRIVERS.find(d => d.id === selectedV.driverId)?.avatar} className="w-full h-full object-cover" />
                      ) : (
                        <Truck className="w-6 h-6 text-primary m-4" />
                      )}
                  </div>
                  <div>
                     <p className="text-lg font-display font-black text-white">{selectedV.registrationNo}</p>
                     <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{selectedV.model}</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-primary/10">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Pilot Signal</span>
                    <span className="text-xs font-bold text-white">{DRIVERS.find(d => d.id === selectedV.driverId)?.name || 'HUB CONTROL'}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-primary/10">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Velocity</span>
                    <span className="text-xl font-display font-black text-primary">{selectedV.speed} <span className="text-[9px]">KMH</span></span>
                  </div>
                  <div className="py-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Energy Status</span>
                      <span className={cn("text-xs font-black", selectedV.fuelLevel < 30 ? "text-danger" : "text-primary")}>{selectedV.fuelLevel}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black border border-primary/10 overflow-hidden">
                       <div className="h-full bg-primary shadow-gold transition-all duration-1000" style={{ width: selectedV.fuelLevel + '%' }} />
                    </div>
                  </div>
               </div>
               
               <button className="w-full mt-6 py-4 rounded-2xl bg-primary text-black font-black uppercase text-[10px] tracking-widest shadow-gold hover:scale-[1.02] transition-transform">
                  Full Telemetry Report
               </button>
            </motion.div>
          ) : (
            <div className="flex-1 glass-card rounded-[24px] border border-white/5 bg-white/[0.01] flex flex-col min-h-[400px]">
               <div className="p-6 border-b border-white/5">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted">Active Node Stack</h3>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/[0.03]">
                  {filteredVehicles.map(v => (
                    <div 
                      key={v.id} 
                      onClick={() => setSelectedId(v.id)}
                      className="p-4 hover:bg-white/[0.03] transition-all cursor-pointer group"
                    >
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                             <Truck className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[13px] font-black text-white truncate uppercase">{v.registrationNo}</p>
                             <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{v.status} • {v.fuelLevel}% Fuel</p>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-black text-white">{v.speed} <span className="text-[8px] text-muted">KMH</span></p>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .leaflet-container { 
          background: #080808 !important; 
          border-radius: 32px;
        }
        .map-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .premium-map-popup .leaflet-popup-content-wrapper {
          background: #111 !important;
          color: white !important;
          padding: 0 !important;
          border-radius: 16px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
        }
        .premium-map-popup .leaflet-popup-tip {
          background: #111 !important;
        }
        .premium-map-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        @keyframes marker-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
