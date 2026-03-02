<template>
  <svg v-bind="$attrs" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hash-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F6FF92"/>
        <stop offset="100%" stop-color="#FDC700"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#clip-hash)">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M9 0.6211C13.6273 0.6211 17.3789 4.3727 17.3789 9C17.3789 13.6273 13.6273 17.3789 9 17.3789C4.3727 17.3789 0.6211 13.6273 0.6211 9C0.6211 4.3727 4.3727 0.6211 9 0.6211ZM4.0283 4.6201L4.0264 4.623L4.0312 4.627L8.502 15.9072L8.9482 15.3662L9.0537 15.2363L9.083 15.2402C9.0843 15.2297 9.0848 15.2145 9.0869 15.1953L15.0322 7.9531L15.2842 7.6455L12.709 5.3564L4.4277 3.9209L3.7012 3.7939L4.0283 4.6201ZM9.2539 13.6865C9.4065 12.3047 9.6295 10.309 9.7969 8.958L13.6221 8.3652L9.2539 13.6865ZM8.9873 8.7715C8.822 10.0974 8.5972 12.1033 8.4414 13.5127L5.3604 5.7383L8.9873 8.7715ZM11.6396 6.0078L9.4121 8.0488L5.751 4.9883L11.6396 6.0078ZM13.8662 7.4912L10.7109 7.9805L12.5361 6.3086L13.8662 7.4912Z" :fill="isActive ? 'url(#hash-gradient)' : '#8A8CA6'"/>
    </g>
    <defs>
      <clipPath id="clip-hash">
        <rect width="18" height="18" fill="white"/>
      </clipPath>
    </defs>
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
