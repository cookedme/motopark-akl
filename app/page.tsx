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
      options: { redirectTo: `${location.origin}/auth/callback` },
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
    <main className="relative w-screen h-screen overflow-hidden font-sans bg-gray-50">
      
      <ParkingMap 
        isAddingMode={isAddingMode} 
        newSpotCoords={newSpotCoords}
        onMapClick={(lat, lng) => setNewSpotCoords({lat, lng})}
        refreshTrigger={refreshTrigger}
        currentUserId={session?.user?.id}
        activeFilter={activeFilter}
      />

      <div className="absolute top-6 left-6 z-10">
        <select 
          value={activeFilter}
          onChange={e => setActiveFilter(e.target.value)}
          className="px-4 py-3 bg-white text-gray-900 rounded-lg font-bold border border-gray-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[position:right_16px_center]"
        >
          <option value="All">Show All Spots</option>
          <option value="Motorcycle Dedicated">Motorcycle Dedicated</option>
          <option value="Free Street Parking">Free Street Parking</option>
          <option value="Paid Parking (Exempt)">Paid Parking (Exempt)</option>
        </select>
      </div>

      {isAddingMode && !newSpotCoords && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg z-10 font-bold shadow-lg animate-pulse">
          Click anywhere on the map to place a parking spot
        </div>
      )}

      {newSpotCoords && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl z-20 w-80 shadow-2xl border border-gray-100">
          <h2 className="mt-0 mb-5 text-gray-900 text-xl font-extrabold">Add Parking Spot</h2>
          <form onSubmit={handleSaveSpot} className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-gray-700">Spot Type</label>
              <select 
                value={spotType} 
                onChange={e => setSpotType(e.target.value)} 
                className="p-2.5 rounded-lg border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option>Motorcycle Dedicated</option>
                <option>Free Street Parking</option>
                <option>Paid Parking (Exempt)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-gray-700">Time Limit</label>
              <select 
                value={timeLimit} 
                onChange={e => setTimeLimit(e.target.value)} 
                className="p-2.5 rounded-lg border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-gray-700">Add a Photo (Optional)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button 
                type="button" 
                onClick={() => { setNewSpotCoords(null); setIsAddingMode(false); setFile(null) }} 
                className="flex-1 p-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isUploading}
                className="flex-1 p-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Saving...' : 'Save Spot'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="absolute top-6 right-6 z-10">
        {session ? (
          (!isAddingMode && !newSpotCoords) && (
            <div className="flex gap-3">
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="px-4 py-2.5 bg-white text-gray-700 rounded-lg font-bold border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors"
              >
                Sign Out
              </button>
              <button 
                onClick={() => setIsAddingMode(true)} 
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors"
              >
                + Add Spot
              </button>
            </div>
          )
        ) : (
          <button 
            onClick={signInWithGoogle} 
            className="px-6 py-3 bg-white text-gray-900 rounded-lg font-extrabold border border-gray-200 shadow-lg hover:bg-gray-50 hover:scale-105 transition-all"
          >
            Sign in to Add Spots
          </button>
        )}
      </div>
    </main>
  )
}