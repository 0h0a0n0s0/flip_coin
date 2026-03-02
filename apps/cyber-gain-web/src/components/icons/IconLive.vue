<template>
  <svg v-bind="$attrs" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="live-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F6FF92"/>
        <stop offset="100%" stop-color="#FDC700"/>
      </linearGradient>
    </defs>
    <path d="M12.252 1.178C15.013 1.1782 17.252 3.4167 17.252 6.178V11.8225C17.252 14.5838 15.013 16.8223 12.252 16.8225H5.748C2.987 16.8225 0.748 14.5839 0.748 11.8225V6.178C0.748 3.4166 2.987 1.178 5.748 1.178H12.252ZM7.885 5.675C7.065 5.2551 5.911 5.7578 5.911 6.8088V11.1936C5.911 12.245 7.066 12.7474 7.885 12.3274L12.16 10.135C13.105 9.6503 13.105 8.3518 12.16 7.8684L7.885 5.675Z" :fill="isActive ? 'url(#live-gradient)' : '#8A8CA6'"/>
  </svg>
</template>

<script setup>
defineProps({
  isActive: {
    type: Boolean,
    default: false
  }
})
</script>
