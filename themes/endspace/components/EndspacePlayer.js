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

/**
 * EndspacePlayer Component - Compact Sci-Fi Music Player for Endspace Theme
 * Acts as a UI remote control for the global APlayer instance.
 * Does not create its own audio element - delegates all playback to APlayer.
 */
export const EndspacePlayer = ({ isExpanded }) => {
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(0)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioList, setAudioList] = useState([])
  const [showPlaylist, setShowPlaylist] = useState(false)
  const playerRef = useRef(null)
  const pollTimerRef = useRef(null)

  const musicPlayerEnabled = siteConfig('MUSIC_PLAYER')
  const playOrder = siteConfig('MUSIC_PLAYER_ORDER')

  // Sync all UI state from the APlayer instance
  const syncState = useCallback((player) => {
    if (!player?.audio) return
    setIsPlaying(!player.audio.paused)
    setCurrentTrack(player.list.index)
    const total = player.audio.duration || 0
    const current = player.audio.currentTime || 0
    setCurrentTime(current)
    setProgress(total > 0 ? (current / total) * 100 : 0)
    if (player.list.audios?.length > 0) {
      setAudioList([...player.list.audios])
    }
  }, [])

  // Poll for the global APlayer instance and bind events once available
  useEffect(() => {
    if (!musicPlayerEnabled) return

    const bindPlayer = (player) => {
      playerRef.current = player
      syncState(player)

      player.on('play', () => setIsPlaying(true))
      player.on('pause', () => setIsPlaying(false))
      player.on('timeupdate', () => {
        if (!player.audio) return
        const total = player.audio.duration || 0
        const current = player.audio.currentTime || 0
        setCurrentTime(current)
        setProgress(total > 0 ? (current / total) * 100 : 0)
      })
      player.on('listswitch', () => {
        setCurrentTrack(player.list.index)
        setProgress(0)
        setCurrentTime(0)
        if (player.list.audios?.length > 0) {
          setAudioList([...player.list.audios])
        }
      })

      setIsReady(true)
    }

    const checkAPlayer = () => {
      if (
        typeof window !== 'undefined' &&
        window.aplayers?.length > 0 &&
        window.aplayers[0]?.audio
      ) {
        bindPlayer(window.aplayers[0])
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
      }
    }

    checkAPlayer()
    if (!playerRef.current) {
      pollTimerRef.current = setInterval(checkAPlayer, 500)
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [musicPlayerEnabled, syncState])

  // Close playlist when sidebar collapses
  useEffect(() => {
    if (!isExpanded) {
      setShowPlaylist(false)
    }
  }, [isExpanded])

  // Don't render if music player is disabled
  if (!musicPlayerEnabled) {
    return null
  }

  const currentAudio = audioList[currentTrack] || {}

  const togglePlay = (e) => {
    e.stopPropagation()
    const player = playerRef.current
    if (!player) return
    player.toggle()
  }

  const playNext = (e) => {
    e?.stopPropagation()
    const player = playerRef.current
    if (!player || audioList.length === 0) return
    if (playOrder === 'random') {
      player.list.switch(Math.floor(Math.random() * audioList.length))
    } else {
      player.list.switch((player.list.index + 1) % audioList.length)
    }
  }

  const playPrev = (e) => {
    e?.stopPropagation()
    const player = playerRef.current
    if (!player || audioList.length === 0) return
    if (playOrder === 'random') {
      player.list.switch(Math.floor(Math.random() * audioList.length))
    } else {
      player.list.switch(
        (player.list.index - 1 + audioList.length) % audioList.length
      )
    }
  }

  const selectTrack = (index) => {
    const player = playerRef.current
    if (!player) return
    if (index === player.list.index) {
      // Same track - play if paused
      if (player.audio.paused) {
        player.play()
      }
    } else {
      player.list.switch(index)
    }
    setShowPlaylist(false)
  }

  const handleProgressClick = (e) => {
    const player = playerRef.current
    if (!player?.audio?.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    player.seek(percentage * player.audio.duration)
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
          {isReady && isPlaying ? (
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
            // Not playing or not ready: Show music icon
            <div className={`w-full h-full rounded-lg flex items-center justify-center bg-[var(--endspace-bg-secondary)] text-[var(--endspace-text-muted)] hover:text-gray-600 hover:bg-gray-200 transition-all ${!isReady ? 'opacity-50 pointer-events-none' : ''}`}>
              <IconMusic size={18} stroke={1.5} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Not ready yet in expanded mode: show minimal placeholder
  if (!isReady || audioList.length === 0) {
    return (
      <div className="endspace-player-full px-3 py-3 relative">
        <div className="flex gap-3 items-center">
          <div className="w-12 h-12 rounded bg-[var(--endspace-bg-secondary)] flex items-center justify-center opacity-50">
            <IconMusic size={20} stroke={1.5} className="text-[var(--endspace-text-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--endspace-text-muted)]">Loading player...</div>
          </div>
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
