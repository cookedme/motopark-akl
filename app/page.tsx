'use client'

import { useEffect, useState } from 'react'
import ParkingMap from '@/components/Map'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [newSpotCoords, setNewSpotCoords] = useState<{lat: number, lng: number} | null>(null)
  const [spotType, setSpotType] = useState('Motorcycle Dedicated')
  const [timeLimit, setTimeLimit] = useState('Unlimited')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeFilter, setActiveFilter] = useState('All')
  
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/` },
    })
  }

  async function handleSaveSpot(e: React.FormEvent) {
    e.preventDefault()
    if (!newSpotCoords || !session) return
    
    setIsUploading(true)

    const { data: spotData, error: spotError } = await supabase.from('parking_spots').insert({
      lat: newSpotCoords.lat,
      lng: newSpotCoords.lng,
      type: spotType,
      time_limit: timeLimit,
      is_active: true,
      user_id: session.user.id
    }).select().single()

    if (spotError) {
      alert("Error saving spot: " + spotError.message)
      setIsUploading(false)
      return
    }

    if (file && spotData) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${spotData.id}-${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('spot-photos')
        .upload(fileName, file)

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('spot-photos').getPublicUrl(fileName)
        
        await supabase.from('spot_photos').insert({
          spot_id: spotData.id,
          user_id: session.user.id,
          photo_url: publicUrlData.publicUrl
        })
      } else {
        alert("Spot saved, but photo upload failed: " + uploadError.message)
      }
    }

    setNewSpotCoords(null)
    setFile(null)
    setIsAddingMode(false)
    setIsUploading(false)
    setRefreshTrigger(prev => prev + 1)
    setActiveFilter('All')
  }

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
      
      <ParkingMap 
        isAddingMode={isAddingMode} 
        newSpotCoords={newSpotCoords}
        onMapClick={(lat, lng) => setNewSpotCoords({lat, lng})}
        refreshTrigger={refreshTrigger}
        currentUserId={session?.user?.id}
        activeFilter={activeFilter}
      />

{/* MASTER CONTAINER */}
<div style={{
  position: 'absolute', top: '16px', left: '16px', right: '16px',
  zIndex: 1000, pointerEvents: 'none',
  display: 'flex', flexDirection: 'column', gap: '12px',
  boxSizing: 'border-box'
}}>
  <select
    value={activeFilter}
    onChange={e => setActiveFilter(e.target.value)}
    style={{
      pointerEvents: 'auto', boxSizing: 'border-box', width: '100%',
      height: '48px', flexShrink: 0, padding: '0 16px',
      backgroundColor: 'white', color: '#111827', borderRadius: '8px',
      fontWeight: 'bold', border: '1px solid #e5e7eb',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', cursor: 'pointer',
      fontSize: '16px'
    }}
  >
    <option value="All">Show All Spots</option>
    <option value="Motorcycle Dedicated">Motorcycle Dedicated</option>
    <option value="Free Street Parking">Free Street Parking</option>
    <option value="Paid Parking (Exempt)">Paid Parking (Exempt)</option>
  </select>

  {session ? (
    (!isAddingMode && !newSpotCoords) && (
      <>
        <button
          onClick={() => setIsAddingMode(true)}
          style={{ pointerEvents: 'auto', boxSizing: 'border-box', width: '100%', height: '48px', flexShrink: 0, backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
        >
          + Add Spot
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ pointerEvents: 'auto', boxSizing: 'border-box', width: '100%', height: '48px', flexShrink: 0, backgroundColor: 'white', color: '#374151', borderRadius: '8px', fontWeight: 'bold', border: '1px solid #d1d5db', cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </>
    )
  ) : (
    <button
      onClick={signInWithGoogle}
      style={{ pointerEvents: 'auto', boxSizing: 'border-box', width: '100%', height: '48px', flexShrink: 0, backgroundColor: 'white', color: '#111827', borderRadius: '8px', fontWeight: '800', border: '1px solid #e5e7eb', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
    >
      Sign in to Add Spots
    </button>
  )}
</div>

      {isAddingMode && !newSpotCoords && (
        <div style={{ position: 'absolute', top: '180px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#111827', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 10, fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          Click anywhere to place a spot
        </div>
      )}

      {newSpotCoords && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', padding: '24px', borderRadius: '12px', zIndex: 20, width: '320px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #f3f4f6' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#111827', fontSize: '1.25rem', fontWeight: '800' }}>Add Parking Spot</h2>
          <form onSubmit={handleSaveSpot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>Spot Type</label>
              <select 
                value={spotType} 
                onChange={e => setSpotType(e.target.value)} 
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              >
                <option>Motorcycle Dedicated</option>
                <option>Free Street Parking</option>
                <option>Paid Parking (Exempt)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>Time Limit</label>
              <select 
                value={timeLimit} 
                onChange={e => setTimeLimit(e.target.value)} 
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              >
                <option>Unlimited</option>
                <option>30 mins</option>
                <option>60 mins</option>
                <option>90 mins</option>
                <option>120 mins</option>
                <option>150 mins</option>
                <option>180 mins</option>
                <option>210 mins</option>
                <option>240 mins</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={() => { setNewSpotCoords(null); setIsAddingMode(false); setFile(null) }} 
                disabled={isUploading}
                style={{ flex: 1, padding: '10px', backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isUploading}
                style={{ flex: 1, padding: '10px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
              >
                {isUploading ? 'Saving...' : 'Save Spot'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}