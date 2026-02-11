import { useState, useEffect, useRef, useCallback } from 'react'
import { siteConfig } from '@/lib/config'
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerTrackPrev,
  IconPlayerTrackNext,
  IconMusic,
  IconList,
  IconVolume,
} from '@tabler/icons-react'

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (error) {
      return value === 'true'
    }
  }
  return fallback
}

/**
 * EndspacePlayer Component - Compact Sci-Fi Music Player for Endspace Theme
 * Integrates with widget.config.js settings
 * Has two states: expanded (full info) and collapsed (rotating cover when playing)
 * Tabler Icons for Futuristic Feel
 */
export const EndspacePlayer = ({ isExpanded }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(0)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const audioRef = useRef(null)
  const autoPlayTimerRef = useRef(null)
  const forcePlayOnTrackChangeRef = useRef(false)

  // Get configuration from widget.config.js
  const musicPlayerEnabled = siteConfig('MUSIC_PLAYER')
  const autoPlay = toBoolean(siteConfig('MUSIC_PLAYER_AUTO_PLAY'), false)
  const playOrder = siteConfig('MUSIC_PLAYER_ORDER')
  const audioList = siteConfig('MUSIC_PLAYER_AUDIO_LIST') || []
  const hasInitializedRef = useRef(false)

  // Don't render if disabled or no audio
  if (!musicPlayerEnabled || audioList.length === 0) {
    return null
  }

  const currentAudio = audioList[currentTrack] || {}

  const pauseExternalPlayers = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (Array.isArray(window.aplayers)) {
      window.aplayers.forEach(player => {
        try {
          player?.pause?.()
        } catch (error) {
          console.warn('Failed to pause external APlayer instance:', error)
        }
      })
    }

    if (typeof document === 'undefined') {
      return
    }

    document.querySelectorAll('audio').forEach(audioElement => {
      if (audioElement === audioRef.current) {
        return
      }
      try {
        audioElement.autoplay = false
        audioElement.pause()
      } catch (error) {
        console.warn('Failed to pause external audio element:', error)
      }
    })
  }, [])

  const playCurrentTrack = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) {
      return false
    }

    pauseExternalPlayers()

    try {
      await audio.play()
      return true
    } catch (error) {
      console.log('Play prevented by browser:', error)
      return false
    }
  }, [pauseExternalPlayers])

  const handleTrackEnd = useCallback(() => {
    forcePlayOnTrackChangeRef.current = true
    if (playOrder === 'random') {
      const randomIndex = Math.floor(Math.random() * audioList.length)
      setCurrentTrack(randomIndex)
    } else {
      setCurrentTrack((prev) => (prev + 1) % audioList.length)
    }
  }, [audioList.length, playOrder])

  // Initialize audio element and bind basic state events
  useEffect(() => {
    const audio = new Audio()
    audio.volume = 0.7
    audio.preload = 'auto'
    audioRef.current = audio

    const syncProgress = () => {
      const total = audio.duration || 0
      const current = audio.currentTime || 0
      setCurrentTime(current)
      setProgress(total > 0 ? (current / total) * 100 : 0)
    }

    const handleAudioPlay = () => setIsPlaying(true)
    const handleAudioPause = () => setIsPlaying(false)
    const handleAudioError = (error) => {
      console.error('Audio load error:', error)
    }

    audio.addEventListener('loadedmetadata', syncProgress)
    audio.addEventListener('timeupdate', syncProgress)
    audio.addEventListener('play', handleAudioPlay)
    audio.addEventListener('pause', handleAudioPause)
    audio.addEventListener('error', handleAudioError)

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
      audio.pause()
      audio.src = ''
      audio.removeEventListener('loadedmetadata', syncProgress)
      audio.removeEventListener('timeupdate', syncProgress)
      audio.removeEventListener('play', handleAudioPlay)
      audio.removeEventListener('pause', handleAudioPause)
      audio.removeEventListener('error', handleAudioError)
      audioRef.current = null
    }
  }, [])

  // Track end event is bound separately to keep callback fresh
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.addEventListener('ended', handleTrackEnd)
    return () => audio.removeEventListener('ended', handleTrackEnd)
  }, [handleTrackEnd])

  // Keep external APlayer/Meting audio paused to avoid hidden background playback
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    pauseExternalPlayers()

    const stopExternalAudio = (event) => {
      const target = event.target
      if (!(target instanceof HTMLAudioElement) || target === audioRef.current) {
        return
      }

      const fromKnownPlayer =
        target.closest('.aplayer') || target.closest('meting-js')
      if (!fromKnownPlayer) {
        return
      }

      target.pause()
    }

    document.addEventListener('play', stopExternalAudio, true)
    return () => document.removeEventListener('play', stopExternalAudio, true)
  }, [pauseExternalPlayers])

  // Load track when currentTrack changes; continue playback only if needed
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentAudio.url) {
      return
    }

    const shouldAutoPlay =
      forcePlayOnTrackChangeRef.current ||
      (hasInitializedRef.current && !audio.paused)

    forcePlayOnTrackChangeRef.current = false
    audio.src = currentAudio.url
    audio.load()
    setProgress(0)
    setCurrentTime(0)

    if (shouldAutoPlay) {
      void playCurrentTrack()
    }
  }, [currentTrack, currentAudio.url, playCurrentTrack])

  // Auto-play only once on initial load (if enabled)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || hasInitializedRef.current) {
      return
    }

    hasInitializedRef.current = true
    if (!autoPlay || !currentAudio.url) {
      return
    }

    autoPlayTimerRef.current = setTimeout(() => {
      forcePlayOnTrackChangeRef.current = true
      void playCurrentTrack()
    }, 800)

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [autoPlay, currentAudio.url, playCurrentTrack])

  // Close playlist when sidebar collapses
  useEffect(() => {
    if (!isExpanded) {
      setShowPlaylist(false)
    }
  }, [isExpanded])

  const togglePlay = (e) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!audio.paused) {
      audio.pause()
      return
    }
    void playCurrentTrack()
  }

  const playNext = (e) => {
    e?.stopPropagation()
    const shouldContinuePlaying = audioRef.current ? !audioRef.current.paused : false
    forcePlayOnTrackChangeRef.current = shouldContinuePlaying
    if (playOrder === 'random') {
      const randomIndex = Math.floor(Math.random() * audioList.length)
      setCurrentTrack(randomIndex)
    } else {
      setCurrentTrack((prev) => (prev + 1) % audioList.length)
    }
  }

  const playPrev = (e) => {
    e?.stopPropagation()
    const shouldContinuePlaying = audioRef.current ? !audioRef.current.paused : false
    forcePlayOnTrackChangeRef.current = shouldContinuePlaying
    setCurrentTrack((prev) => (prev - 1 + audioList.length) % audioList.length)
  }

  const selectTrack = (index) => {
    if (index === currentTrack) {
      if (audioRef.current?.paused) {
        void playCurrentTrack()
      }
      setShowPlaylist(false)
      return
    }

    forcePlayOnTrackChangeRef.current = true
    setCurrentTrack(index)
    setShowPlaylist(false)
  }

  const handleProgressClick = (e) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    audio.currentTime = percentage * audio.duration
    setCurrentTime(audio.currentTime)
    setProgress(percentage * 100)
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Collapsed State: Rotating cover when playing, music icon when not
  if (!isExpanded) {
    return (
      <div className="endspace-player-mini flex justify-center py-2">
        <div 
          className={`relative w-10 h-10 cursor-pointer group flex items-center justify-center`}
          onClick={togglePlay}
        >
          {isPlaying ? (
            // Playing: Show rotating album cover
            <>
              <div className="w-full h-full rounded-full overflow-hidden endspace-player-glow endspace-player-rotating">
                <img 
                  src={currentAudio.cover || '/default-cover.jpg'} 
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Pause overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <IconPlayerPause size={14} stroke={2} className="text-white" />
              </div>
            </>
          ) : (
            // Not playing: Show music icon
            <div className="w-full h-full rounded-lg flex items-center justify-center bg-[var(--endspace-bg-secondary)] text-[var(--endspace-text-muted)] hover:text-gray-600 hover:bg-gray-200 transition-all">
              <IconMusic size={18} stroke={1.5} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Expanded State: Compact player with album cover as play button
  return (
    <div className="endspace-player-full px-3 py-3 relative">
      {/* Main Content Row */}
      <div className="flex gap-3 items-start">
        {/* Album Cover with integrated play button */}
        <div 
          className={`relative flex-shrink-0 w-12 h-12 rounded cursor-pointer overflow-hidden group ${isPlaying ? 'endspace-player-glow' : ''}`}
          onClick={togglePlay}
        >
          <img 
            src={currentAudio.cover || '/default-cover.jpg'} 
            alt="Album Cover"
            className={`w-full h-full object-cover transition-transform duration-300 ${isPlaying ? 'scale-105' : ''}`}
          />
          {/* Play/Pause Overlay */}
          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
            {isPlaying ? (
              <IconPlayerPause size={16} stroke={2} className="text-white" />
            ) : (
              <IconPlayerPlay size={16} stroke={2} className="text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-sm font-bold text-[var(--endspace-text-primary)] truncate leading-tight">
            {currentAudio.name || 'Unknown Track'}
          </div>
          <div className="text-xs text-[var(--endspace-text-muted)] truncate mt-0.5">
            {currentAudio.artist || 'Unknown Artist'}
          </div>
          {/* Progress Bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div 
              className="flex-1 h-1 bg-[var(--endspace-bg-tertiary)] rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-[var(--endspace-accent-yellow)] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-[var(--endspace-text-muted)] w-8 text-right">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

          {/* Right side: Playlist button + Prev/Next buttons */}
        <div className="flex flex-col items-center gap-1">
          {/* Playlist Toggle Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); setShowPlaylist(!showPlaylist) }}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${showPlaylist ? 'bg-black text-white' : 'text-[var(--endspace-text-muted)] hover:text-black'}`}
            title="Playlist"
          >
            <IconList size={12} stroke={1.5} />
          </button>
          
          {/* Prev/Next Buttons (horizontal) */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={playPrev}
              className="w-5 h-5 flex items-center justify-center text-[var(--endspace-text-muted)] hover:text-black transition-colors"
              title="Previous"
            >
              <IconPlayerTrackPrev size={11} stroke={1.5} />
            </button>
            <button 
              onClick={playNext}
              className="w-5 h-5 flex items-center justify-center text-[var(--endspace-text-muted)] hover:text-black transition-colors"
              title="Next"
            >
              <IconPlayerTrackNext size={11} stroke={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Dropdown */}
      {showPlaylist && (
        <div className="mt-2 max-h-36 overflow-y-auto bg-[var(--endspace-bg-secondary)] rounded">
          {audioList.map((audio, index) => (
            <div 
              key={index}
              onClick={() => selectTrack(index)}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                index === currentTrack 
                  ? 'bg-black text-white' 
                  : 'hover:bg-[var(--endspace-bg-tertiary)]'
              }`}
            >
              {/* Song name line */}
              <div className={`text-xs truncate flex items-center gap-1.5 ${
                index === currentTrack ? 'text-white font-medium' : 'text-[var(--endspace-text-secondary)]'
              }`}>
                {index === currentTrack && isPlaying && (
                  <IconVolume size={11} stroke={1.5} className="flex-shrink-0" />
                )}
                {index === currentTrack && !isPlaying && (
                  <IconPlayerPause size={11} stroke={1.5} className="flex-shrink-0" />
                )}
                {index !== currentTrack && (
                  <span className="w-3 text-center font-mono text-[9px] text-[var(--endspace-text-muted)] flex-shrink-0">{index + 1}</span>
                )}
                <span className="truncate">{audio.name}</span>
              </div>
              {/* Artist name line (smaller) */}
              <div className="text-[10px] text-[var(--endspace-text-muted)] truncate pl-4 mt-0.5">
                {audio.artist}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EndspacePlayer
