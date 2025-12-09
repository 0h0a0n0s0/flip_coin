<template>
  <div
    class="game-card"
    :class="{ 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="handleClick"
  >
    <div class="game-card-thumbnail">
      <div class="thumbnail-placeholder" :style="thumbnailStyle">
        <component :is="gameIcon" v-if="gameIcon" class="thumbnail-icon" />
      </div>
      
      <div class="badges">
        <span v-if="game.hot" class="badge badge-hot">
          <Lightning class="badge-icon" />
          HOT
        </span>
        <span v-if="game.new" class="badge badge-new">NEW</span>
      </div>

      <div v-if="isHovered" class="hover-overlay">
        <button class="play-button" @click.stop="handlePlay">
          <VideoPlay class="play-icon" />
          Play
        </button>
      </div>
    </div>

    <div class="game-card-info">
      <div class="game-title-row">
        <h3 class="game-title">{{ game.name }}</h3>
      </div>
      <p class="game-provider">{{ game.provider || 'FairHash' }}</p>
      
      <div class="game-stats">
        <div v-if="game.rating" class="stat-rating">
          <Star class="stat-icon" />
          <span class="stat-value">{{ game.rating }}</span>
        </div>
        <div v-if="game.volume" class="stat-volume">
          {{ game.volume }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Lightning, VideoPlay, Star, Coin } from '@element-plus/icons-vue'

const props = defineProps({
  game: {
    type: Object,
    required: true
  },
  onClick: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['click', 'play'])

const isHovered = ref(false)

const gameIcon = computed(() => {
  if (props.game.icon) return props.game.icon
  return Coin
})

const thumbnailStyle = computed(() => {
  if (props.game.thumbnail) {
    return {
      backgroundImage: `url(${props.game.thumbnail})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  return {
    background: 'linear-gradient(135deg, rgba(243, 195, 64, 0.2), rgba(138, 108, 244, 0.2))'
  }
})

function handleClick() {
  if (props.onClick) {
    props.onClick(props.game)
  }
  emit('click', props.game)
}

function handlePlay(e) {
  e.stopPropagation()
  emit('play', props.game)
}
</script>

<style scoped>
.game-card {
  background-color: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}

.game-card:hover {
  border-color: rgba(243, 195, 64, 0.5);
  box-shadow: 0 4px 12px rgba(243, 195, 64, 0.1);
}

.game-card-thumbnail {
  position: relative;
  width: 100%;
  height: 105px;
  overflow: hidden;
}

@media (min-width: 768px) {
  .game-card-thumbnail {
    height: 115px;
  }
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-position: center;
  transition: transform 0.5s;
}

.game-card:hover .thumbnail-placeholder {
  transform: scale(1.1);
}

.thumbnail-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.badges {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  z-index: 10;
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 var(--space-2);
  font-size: 9px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: none;
  color: white;
}

.badge-hot {
  background-color: rgba(239, 68, 68, 0.9);
}

.badge-new {
  background-color: rgba(34, 197, 94, 0.9);
}

.badge-icon {
  width: 8px;
  height: 8px;
  margin-right: var(--space-1);
}

.hover-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.game-card.is-hovered .hover-overlay {
  opacity: 1;
}

.play-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 28px;
  padding: 0 var(--space-3);
  background-color: var(--primary);
  color: var(--surface);
  border: none;
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(243, 195, 64, 0.3);
}

.play-button:hover {
  background-color: #E5B530;
  transform: scale(1.05);
}

.play-icon {
  width: 10px;
  height: 10px;
}

.game-card-info {
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.game-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
}

.game-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.game-provider {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  padding-top: var(--space-1);
}

.stat-rating {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.stat-icon {
  width: 10px;
  height: 10px;
  color: var(--primary);
}

.stat-value {
  font-size: 10px;
  font-weight: 600;
  color: var(--foreground);
}

.stat-volume {
  font-size: 9px;
  color: var(--accent);
  font-weight: 500;
}
</style>
