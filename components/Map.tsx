'use client'

import { useEffect, useState } from 'react'
import MapboxMap, { Marker, NavigationControl, GeolocateControl, Popup } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { createClient } from '@/lib/supabase'

interface ParkingSpot {
  id: string
  lat: number
  lng: number
  type: string
  time_limit: string
  is_active: boolean
  user_id: string
}

interface SpotPhoto {
  id: string
  photo_url: string
  user_id: string
}

interface ParkingMapProps {
  isAddingMode: boolean
  newSpotCoords: { lat: number; lng: number } | null
  onMapClick: (lat: number, lng: number) => void
  refreshTrigger: number
  currentUserId?: string
  activeFilter: string
}

export default function ParkingMap({ isAddingMode, newSpotCoords, onMapClick, refreshTrigger, currentUserId, activeFilter }: ParkingMapProps) {
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null)
  
  const [spotPhotos, setSpotPhotos] = useState<SpotPhoto[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  
  const supabase = createClient()

  const [viewState, setViewState] = useState({
    longitude: 174.7633, 
    latitude: -36.8485,
    zoom: 12
  })

  useEffect(() => {
    async function fetchSpots() {
      const { data } = await supabase.from('parking_spots').select('*').eq('is_active', true)
      if (data) setSpots(data)
    }
    fetchSpots()
  }, [refreshTrigger]) 

  useEffect(() => {
    async function fetchPhotos(spotId: string) {
      const { data } = await supabase.from('spot_photos').select('*').eq('spot_id', spotId)
      if (data) setSpotPhotos(data)
    }
    
    if (selectedSpot) {
      fetchPhotos(selectedSpot.id)
    } else {
      setSpotPhotos([])
      setUploadFile(null)
    }
  }, [selectedSpot])

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 15
          })
        },
        (error) => console.warn("Location access denied or unavailable:", error),
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [])

  async function handleDeleteSpot(spotId: string) {
    if (!confirm("Are you sure you want to delete this parking spot?")) return

    const { error } = await supabase.from('parking_spots').delete().eq('id', spotId)
    
    if (error) {
      alert("Error deleting spot: " + error.message)
    } else {
      setSpots(prev => prev.filter(s => s.id !== spotId))
      setSelectedSpot(null)
    }
  }

  async function handleAddPhotoToExistingSpot() {
    if (!uploadFile || !selectedSpot || !currentUserId) return
    setIsUploadingPhoto(true)

    const fileExt = uploadFile.name.split('.').pop()
    const fileName = `${selectedSpot.id}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('spot-photos')
      .upload(fileName, uploadFile)

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from('spot-photos').getPublicUrl(fileName)
      
      const { data: newPhoto, error: dbError } = await supabase.from('spot_photos').insert({
        spot_id: selectedSpot.id,
        user_id: currentUserId,
        photo_url: publicUrlData.publicUrl
      }).select().single()

      if (!dbError && newPhoto) {
        setSpotPhotos(prev => [...prev, newPhoto])
        setUploadFile(null)
      }
    } else {
      alert("Error uploading photo: " + uploadError.message)
    }
    
    setIsUploadingPhoto(false)
  }

  const filteredSpots = spots.filter(spot => 
    activeFilter === 'All' ? true : spot.type === activeFilter
  )

  function getMarkerColor(type: string) {
    switch (type) {
      case 'Motorcycle Dedicated': return 'bg-blue-600'
      case 'Free Street Parking': return 'bg-green-500'
      case 'Paid Parking (Exempt)': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="relative w-full h-full">
      <MapboxMap
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        cursor={isAddingMode ? 'crosshair' : 'grab'}
        onClick={(e) => {
          if (isAddingMode) {
            onMapClick(e.lngLat.lat, e.lngLat.lng)
            setSelectedSpot(null)
          }
        }}
      >
        <GeolocateControl position="top-right" trackUserLocation showAccuracyCircle={false} />
        <NavigationControl position="top-right" />
        
        {filteredSpots.map((spot) => (
          <Marker 
            key={spot.id} 
            longitude={spot.lng} 
            latitude={spot.lat} 
            anchor="bottom"
            onClick={e => {
              e.originalEvent.stopPropagation()
              if (!isAddingMode) {
                setSelectedSpot(spot)
              }
            }}
          >
            <div className={`w-6 h-6 ${getMarkerColor(spot.type)} rounded-full border-2 border-white cursor-pointer shadow-md hover:scale-110 transition-transform`} />
          </Marker>
        ))}

        {selectedSpot && (
          <Popup
            longitude={selectedSpot.lng}
            latitude={selectedSpot.lat}
            anchor="bottom"
            offset={30}
            onClose={() => setSelectedSpot(null)}
            closeOnClick={true}
            className="z-50"
          >
            <div className="p-2 flex flex-col gap-1 min-w-[220px]">
              <h3 className="font-extrabold text-gray-900 text-sm">{selectedSpot.type}</h3>
              <p className="text-gray-700 text-xs font-medium mb-1">Limit: {selectedSpot.time_limit}</p>
              
              {spotPhotos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1 my-1 border-t border-gray-100 snap-x">
                  {spotPhotos.map(photo => (
                    <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={photo.photo_url} 
                        alt="Parking spot" 
                        className="h-16 w-16 object-cover rounded-md flex-shrink-0 shadow-sm border border-gray-200 snap-center hover:opacity-80 transition-opacity" 
                      />
                    </a>
                  ))}
                </div>
              )}

              {currentUserId && (
                <div className="mt-1 flex flex-col gap-1 border-t border-gray-100 pt-2">
                  <span className="text-xs font-bold text-gray-700">Upload a photo of the spot</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    className="text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer mt-1"
                  />
                  {uploadFile && (
                    <button 
                      onClick={handleAddPhotoToExistingSpot}
                      disabled={isUploadingPhoto}
                      className="w-full py-1.5 mt-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isUploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </button>
                  )}
                </div>
              )}

              {currentUserId === selectedSpot.user_id && (
                <button 
                  onClick={() => handleDeleteSpot(selectedSpot.id)}
                  className="mt-2 w-full py-1.5 bg-red-50 text-red-600 rounded border border-red-100 text-xs font-bold hover:bg-red-100 hover:border-red-200 transition-colors"
                >
                  Delete Spot
                </button>
              )}
            </div>
          </Popup>
        )}

        {newSpotCoords && (
          <Marker longitude={newSpotCoords.lng} latitude={newSpotCoords.lat} anchor="bottom">
            <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-md animate-bounce" />
          </Marker>
        )}
      </MapboxMap>
    </div>
  )
}