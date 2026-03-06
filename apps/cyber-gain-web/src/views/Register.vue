<template>
  <!-- Auth 獨立頁（登入/註冊）：畫面區與首頁同寬 max-w-[500px]，居中顯示 -->
  <div
    class="register-page fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] bg-[#0F182F] flex flex-col overscroll-contain"
    style="height: 100dvh; max-height: 100dvh; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;"
  >
      <!-- Background Effects (光晕为最底层，仅底色之上) + Gradient transition -->
      <div class="absolute top-0 left-0 right-0 h-[240px] overflow-hidden pointer-events-none z-0">
        <div class="absolute inset-0">
          <!-- 1. Header黄色光晕：右上角半圆 -->
          <div
            class="absolute -top-20 -right-20 w-[200px] h-[200px] rounded-full opacity-80"
            style="background: radial-gradient(circle, rgba(255, 242, 0, 0.7) 0%, rgba(255, 242, 0, 0.3) 40%, transparent 70%); filter: blur(40px);"
          ></div>
          <!-- 2. 綠色光暈 (左下區域) -->
          <div class="absolute w-[170px] h-[156px] opacity-80" style="left: -80px; top: 180px; transform: rotate(43deg); filter: blur(52px);">
            <div class="w-full h-full bg-[#8cff00]"></div>
          </div>
          <!-- 3. 藍色光暈 (右中區域) -->
          <div class="absolute w-[100px] h-[100px] opacity-80" style="left: 200px; top: 80px; filter: blur(45px);">
            <div class="w-full h-full bg-[#00d0ff]"></div>
          </div>
          <!-- 4. Gradient transition: 减轻渐层，让光晕可见 (光晕区与纯色区渐层过渡) -->
          <div
            class="absolute bottom-0 left-0 right-0 h-[48px]"
            style="background: linear-gradient(to bottom, transparent 0%, rgba(15, 24, 47, 0.2) 50%, rgba(15, 24, 47, 0.6) 85%, #0F182F 100%);"
          ></div>
        </div>
      </div>

      <!-- Main Content Container：flex-1 + min-h-0 + overflow-y-auto，放得下則不出現捲軸；放不下才可滾動 -->
      <div class="relative w-full max-w-[375px] mx-auto flex-1 min-h-0 overflow-y-auto z-10 pb-12 sm:pb-[88px]">
        <!-- Banner Section -->
        <div class="relative h-[200px] w-full">
          <!-- 移除 Top Gradient Overlay，光晕不影响宝箱和文字 -->
          
          <!-- Logo Image (centered at ~140px-217px) -->
          <div class="absolute left-[140px] top-[4px] w-[217px] h-[212px]">
            <img src="/images/auth/registerPage-Logo.png" alt="Welcome Bonus" class="w-full h-full object-contain" />
          </div>

          <!-- Close Button -->
          <button
            @click="handleClose"
            class="absolute right-[12px] top-[12px] w-4 h-4 flex items-center justify-center z-10"
            aria-label="返回首頁"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12.535 3.465a.5.5 0 0 1 0 .707l-8.363 8.363a.5.5 0 1 1-.707-.707l8.363-8.363a.5.5 0 0 1 .707 0Z" fill="white"/>
              <path d="M3.465 3.465a.5.5 0 0 1 .707 0l8.363 8.363a.5.5 0 1 1-.707.707L3.465 4.172a.5.5 0 0 1 0-.707Z" fill="white"/>
            </svg>
          </button>

          <!-- Logo (Top Left) -->
          <div class="absolute left-4 top-[15px] w-[161px] h-[35px]">
            <img src="/images/common/platformLogo.svg" alt="CYBER GAIN" class="w-full h-full" />
          </div>

          <!-- Welcome Text -->
          <div class="absolute left-[27px] top-[77px] w-[152px]">
            <div class="flex flex-col" style="gap: 1px;">
              <p class="text-[24px] font-bold leading-[32px]" style="font-family: 'Alibaba PuHuiTi 3.0', sans-serif; background: linear-gradient(90deg, #F6FF92 0%, #FDC700 50%, #E5A500 100%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 1.75px rgba(255, 234, 0, 0.7));">
                欢迎奖励
              </p>
              <p class="text-[24px] font-bold leading-[32px]" style="font-family: 'Alibaba PuHuiTi 3.0', sans-serif; background: linear-gradient(90deg, #F6FF92 0%, #FDC700 50%, #E5A500 100%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 1.75px rgba(255, 234, 0, 0.7));">
                高达 888%
              </p>
            </div>
            <p class="text-[#d5d5d5] text-[12px] font-normal leading-[20px] text-left mt-[1px]" style="font-family: 'Alibaba PuHuiTi 3.0', sans-serif;">
              + 225 次免费旋转
            </p>
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="relative w-[327px] mx-auto h-10 flex items-end overflow-hidden">
          <button
            @click="switchTab('login')"
            class="flex-1 h-10 flex items-center justify-center relative"
          >
            <span
              class="text-[14px] leading-[20px] transition-all duration-200"
              :class="activeTab === 'login' ? 'text-[#fdc700] font-bold' : 'text-[#8a8ca6] font-medium'"
              style="font-family: 'Helvetica Neue', sans-serif; letter-spacing: -0.15px;"
            >
              登录
            </span>
            <!-- Elliptical Glow (from text bottom to tab bottom, clipped) -->
            <div
              v-if="activeTab === 'login'"
              class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[100px] h-[10px] pointer-events-none"
              style="
                background: radial-gradient(ellipse at center bottom, rgba(253, 199, 0, 0.8) 0%, rgba(253, 199, 0, 0.4) 40%, rgba(253, 199, 0, 0) 70%);
                filter: blur(4px);
              "
            ></div>
          </button>

          <button
            @click="switchTab('register')"
            class="flex-1 h-10 flex items-center justify-center relative"
          >
            <span
              class="text-[14px] leading-[20px] transition-all duration-200"
              :class="activeTab === 'register' ? 'text-[#fdc700] font-bold' : 'text-[#8a8ca6] font-medium'"
              style="font-family: 'Helvetica Neue', sans-serif; letter-spacing: -0.15px;"
            >
              注册
            </span>
            <!-- Elliptical Glow (from text bottom to tab bottom, clipped) -->
            <div
              v-if="activeTab === 'register'"
              class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[100px] h-[10px] pointer-events-none"
              style="
                background: radial-gradient(ellipse at center bottom, rgba(253, 199, 0, 0.8) 0%, rgba(253, 199, 0, 0.4) 40%, rgba(253, 199, 0, 0) 70%);
                filter: blur(4px);
              "
            ></div>
          </button>

          <!-- Bottom Border -->
          <div class="absolute bottom-0 left-0 w-full h-[1px] bg-[#1b2a52]"></div>
        </div>


        <!-- Form Container：小屏緊湊間距以利一屏顯示；大屏舒適間距 -->
        <div class="w-[327px] mx-auto mt-3 sm:mt-5 flex flex-col gap-3 sm:gap-5">
          <!-- Login Form -->
          <div v-if="activeTab === 'login'" class="flex flex-col gap-3 sm:gap-[30px]">
            <!-- Form Fields -->
            <div class="flex flex-col gap-3">
              <!-- 帳號 Input -->
              <div class="h-[52px] rounded-lg">
                <div class="h-full flex items-center gap-3 px-3 rounded-[5px] bg-[#0b1223] border border-[#1b2a52] focus-within:border-[#355FD1] transition-colors duration-200">
                  <img src="/images/auth/account.svg" alt="" class="w-4 h-4 flex-shrink-0" />
                  <input
                    v-model="loginForm.email"
                    type="text"
                    placeholder="输入帐号"
                    class="flex-1 bg-transparent border-none outline-none text-white placeholder-[#8a8ca6] text-[14px]"
                    style="font-family: 'Helvetica Neue', sans-serif;"
                  />
                </div>
              </div>

              <!-- Password Input -->
              <div class="h-[52px] rounded-lg">
                <div class="h-full flex items-center justify-between gap-3 px-3 rounded-[5px] bg-[#0b1223] border border-[#1b2a52] focus-within:border-[#355FD1] transition-colors duration-200">
                  <div class="flex items-center gap-3">
                    <img src="/images/auth/password.svg" alt="" class="w-4 h-4 flex-shrink-0" />
                    <input
                      v-model="loginForm.password"
                      :type="showLoginPassword ? 'text' : 'password'"
                      placeholder="输入密码"
                      class="flex-1 bg-transparent border-none outline-none text-white placeholder-[#8a8ca6] text-[14px]"
                      style="font-family: 'Helvetica Neue', sans-serif;"
                    />
                  </div>
                  <button @click="showLoginPassword = !showLoginPassword" class="flex-shrink-0">
                    <img :src="showLoginPassword ? '/images/auth/passwordOpen.svg' : '/images/auth/passwordClose.svg'" alt="" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Checkbox and Button -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <input
                  v-model="loginForm.remember"
                  type="checkbox"
                  id="remember-login"
                  class="checkbox-terms mt-0.5 w-[14px] h-[14px] min-w-[14px] min-h-[14px] rounded-[3px] border border-[#8a8ca6] flex-shrink-0"
                />
                <label for="remember-login" class="text-[#8a8ca6] text-[12px] font-medium" style="font-family: 'Helvetica Neue', sans-serif;">
                  记住我
                </label>
              </div>

              <button
                @click="handleLogin"
                :disabled="loading"
                class="w-full h-11 rounded-lg flex items-center justify-center text-[#101828] text-[14px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style="font-family: 'Helvetica Neue', sans-serif; letter-spacing: -0.15px; background: linear-gradient(123.38deg, #F6FF92 0%, #FDC700 100%); box-shadow: 0px 2px 0px 0px #A27F00, 0px 0px 5.25px 0px rgba(255, 229, 0, 0.7);"
              >
                {{ loading ? t('auth.logging_in') : t('auth.login') }}
              </button>
            </div>
          </div>

          <!-- Register Form -->
          <div v-if="activeTab === 'register'" class="flex flex-col gap-3 sm:gap-5">
            <!-- Form Fields -->
            <div class="flex flex-col gap-3">
              <!-- 帳號 Input -->
              <div class="rounded-lg">
                <div
                  class="h-[52px] flex items-center gap-3 px-3 rounded-[5px] bg-[#0b1223] border transition-colors duration-200"
                  :class="usernameError ? 'border-[#F04248] focus-within:border-[#F04248]' : 'border-[#1b2a52] focus-within:border-[#355FD1]'"
                >
                  <img src="/images/auth/account.svg" alt="" class="w-4 h-4 flex-shrink-0" />
                  <input
                    v-model="registerForm.email"
                    type="text"
                    placeholder="输入帐号"
                    class="flex-1 bg-transparent border-none outline-none text-white placeholder-[#8a8ca6] text-[14px]"
                    style="font-family: 'Helvetica Neue', sans-serif;"
                    @input="usernameError = null"
                  />
                </div>
                <p
                  v-if="usernameError"
                  class="mt-1 text-[14px] text-[#F04248]"
                  style="font-family: 'Helvetica Neue', sans-serif;"
                >
                  {{ t('auth.username_format_error') }}
                </p>
              </div>

              <!-- Password Input -->
              <div class="rounded-lg">
                <div
                  class="h-[52px] flex items-center justify-between gap-3 px-3 rounded-[5px] bg-[#0b1223] border transition-colors duration-200"
                  :class="passwordError ? 'border-[#F04248] focus-within:border-[#F04248]' : 'border-[#1b2a52] focus-within:border-[#355FD1]'"
                >
                  <div class="flex items-center gap-3">
                    <img src="/images/auth/password.svg" alt="" class="w-4 h-4 flex-shrink-0" />
                    <input
                      v-model="registerForm.password"
                      :type="showRegisterPassword ? 'text' : 'password'"
                      placeholder="输入密码"
                      class="flex-1 bg-transparent border-none outline-none text-white placeholder-[#8a8ca6] text-[14px]"
                      style="font-family: 'Helvetica Neue', sans-serif;"
                      @input="passwordError = null"
                    />
                  </div>
                  <button @click="showRegisterPassword = !showRegisterPassword" class="flex-shrink-0">
                    <img :src="showRegisterPassword ? '/images/auth/passwordOpen.svg' : '/images/auth/passwordClose.svg'" alt="" class="w-4 h-4" />
                  </button>
                </div>
                <p
                  v-if="passwordError"
                  class="mt-1 text-[14px] text-[#F04248]"
                  style="font-family: 'Helvetica Neue', sans-serif;"
                >
                  {{ t('auth.password_format_error') }}
                </p>
              </div>

              <!-- Referral Code Input -->
              <div class="rounded-lg">
                <div
                  class="h-[52px] flex items-center gap-3 px-3 rounded-[5px] bg-[#0b1223] border transition-colors duration-200"
                  :class="referralCodeError ? 'border-[#F04248] focus-within:border-[#F04248]' : 'border-[#1b2a52] focus-within:border-[#355FD1]'"
                >
                  <img src="/images/auth/promote.svg" alt="" class="w-4 h-4 flex-shrink-0" />
                  <input
                    v-model="registerForm.referralCode"
                    type="text"
                    placeholder="输入推荐或促销代码(可不填)"
                    class="flex-1 bg-transparent border-none outline-none text-white placeholder-[#8a8ca6] text-[14px]"
                    style="font-family: 'Helvetica Neue', sans-serif;"
                    @input="referralCodeError = null"
                  />
                </div>
                <p
                  v-if="referralCodeError"
                  class="mt-1 text-[14px] text-[#F04248]"
                  style="font-family: 'Helvetica Neue', sans-serif;"
                >
                  {{ referralCodeError === 'not_found' ? t('auth.referral_code_not_found') : t('auth.referral_code_format_error') }}
                </p>
              </div>
            </div>

            <!-- Checkbox and Button -->
            <div class="flex flex-col gap-3">
              <div class="flex items-start gap-2">
                <input
                  v-model="registerForm.agreeTerms"
                  type="checkbox"
                  id="agree-terms"
                  class="checkbox-terms mt-0.5 w-[14px] h-[14px] min-w-[14px] min-h-[14px] rounded-[3px] border border-[#8a8ca6] flex-shrink-0"
                />
                <label for="agree-terms" class="text-[#d0d0d0] text-[12px] font-medium leading-[16px]" style="font-family: 'Helvetica Neue', sans-serif;">
                  我确认我已年满 18 岁，并且已阅读 <a href="#" class="text-[#4682B4] underline">服务条款</a>
                </label>
              </div>

              <button
                @click="handleRegister"
                :disabled="!registerForm.agreeTerms || loading || !!referralCodeError"
                class="w-full h-11 rounded-lg flex items-center justify-center text-[#101828] text-[14px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style="font-family: 'Helvetica Neue', sans-serif; letter-spacing: -0.15px; background: linear-gradient(123.38deg, #F6FF92 0%, #FDC700 100%); box-shadow: 0px 2px 0px 0px #A27F00, 0px 0px 5.25px 0px rgba(255, 229, 0, 0.7);"
              >
                {{ loading ? t('auth.registering') : t('auth.register_account') }}
              </button>
            </div>
          </div>

          <!-- Divider and Social Login -->
          <div class="flex flex-col gap-4 items-center">
            <div class="w-full flex items-center gap-3">
              <div class="flex-1 h-[1px] bg-[#1b2a52]"></div>
              <span class="text-[#8a8ca6] text-[14px] font-medium" style="font-family: 'Helvetica Neue', sans-serif;">或</span>
              <div class="flex-1 h-[1px] bg-[#1b2a52]"></div>
            </div>

            <div class="flex items-center gap-[10px]">
              <button
                @click="handleGoogleLogin"
                class="w-[46px] h-[46px] rounded-[10px] bg-[#1b2a52] flex items-center justify-center"
              >
                <img src="/images/auth/registLogin-google.svg" alt="Google" class="w-5 h-5 object-contain" />
              </button>

              <button
                @click="handleTelegramLogin"
                class="w-[46px] h-[46px] rounded-[10px] bg-[#1b2a52] flex items-center justify-center"
              >
                <img src="/images/auth/registLogin-telegram.svg" alt="Telegram" class="w-5 h-5 object-contain" />
              </button>
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth.js'
import { useSocket } from '@/composables/useSocket.js'
import { getToken } from '@/store/index.js'
import { notifyError } from '@/utils/notify.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { handleLogin: doLogin, handleRegister: doRegister, loading } = useAuth()
const { initializeSocket } = useSocket()

// activeTab 由 URL query 決定，無效值 fallback 為 register
const activeTab = computed(() => {
  const tab = route.query.tab
  return tab === 'login' ? 'login' : 'register'
})

const switchTab = (tab) => {
  router.replace({ path: '/auth', query: { tab } })
}

const handleClose = () => {
  router.push('/')
}

// 非法 tab 值時修正 URL
watch(
  () => route.query.tab,
  (tab) => {
    if (tab && tab !== 'login' && tab !== 'register') {
      router.replace({ path: '/auth', query: { tab: 'register' } })
    }
  },
  { immediate: true }
)

const loginForm = ref({
  email: '',
  password: '',
  remember: false
})

const registerForm = ref({
  email: '',
  password: '',
  referralCode: '',
  agreeTerms: false
})

const showLoginPassword = ref(false)
const showRegisterPassword = ref(false)
const referralCodeError = ref(null) // null | 'format_error' | 'not_found'
const usernameError = ref(null) // 帳號格式錯誤時為 true
const passwordError = ref(null) // 密碼格式錯誤時為 true

// 註冊格式：帳號 6-32 字，英文大小寫、數字、. _ - @；密碼 8-64 字，允許所有字符
const REGISTER_USERNAME_REGEX = /^[a-zA-Z0-9._\-@]{6,32}$/
const REGISTER_PASSWORD_REGEX = /^.{8,64}$/

async function handleLogin() {
  const success = await doLogin(loginForm.value.email, loginForm.value.password)
  if (success) {
    const token = getToken()
    if (token) {
      initializeSocket(token)
    }
    router.push(route.query.redirect || '/')
  }
}

async function handleRegister() {
  referralCodeError.value = null
  usernameError.value = null
  passwordError.value = null
  if (!registerForm.value.agreeTerms) {
    notifyError(t('auth.agree_terms_required'))
    return
  }
  const username = registerForm.value.email?.trim() ?? ''
  const password = registerForm.value.password ?? ''
  // 同時檢查帳號、密碼，空值或格式不符皆顯示錯誤樣式
  const hasUsernameError = !REGISTER_USERNAME_REGEX.test(username)
  const hasPasswordError = !REGISTER_PASSWORD_REGEX.test(password)
  if (hasUsernameError) usernameError.value = true
  if (hasPasswordError) passwordError.value = true
  if (hasUsernameError || hasPasswordError) return
  const code = registerForm.value.referralCode?.trim()
  const result = await doRegister(
    username,
    password,
    undefined,
    code ? code.toUpperCase() : undefined
  )
  if (result && typeof result === 'object' && !result.success && result.errorType) {
    if (result.errorType === 'username_format') {
      usernameError.value = true
    } else if (result.errorType === 'password_format') {
      passwordError.value = true
    } else {
      referralCodeError.value = result.errorType
    }
    return
  }
  if (result) {
    const token = getToken()
    if (token) {
      initializeSocket(token)
    }
    router.push(route.query.redirect || '/')
  }
}

const handleGoogleLogin = () => {
  console.log('[Register] Google 登入')
}

const handleTelegramLogin = () => {
  console.log('[Register] Telegram 登入')
}
</script>

<style scoped>
.register-page {
  font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Custom Checkbox Styling */
input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  position: relative;
}

/* 记住我 / 服务条款 - 登入与注册页 checkbox 统一样式 */
.checkbox-terms:checked {
  background-color: #3F8CFF;
  border-color: #3F8CFF;
}

.checkbox-terms:checked::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background-color: white;
  -webkit-mask: url("data:image/svg+xml,%3Csvg width='15' height='15' viewBox='0 0 15 15' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M11.7816 4.03157C12.0062 4.19877 12.0622 4.51126 11.895 4.73586L7.14503 11.2359C7.06266 11.3453 6.93748 11.4141 6.80001 11.4254C6.66254 11.4367 6.52756 11.3894 6.42928 11.2954L3.67928 8.79544C3.47641 8.60818 3.46461 8.29097 3.65188 8.08809C3.83914 7.88522 4.15636 7.87342 4.35923 8.06069L6.70668 10.2369L11.105 4.26414C11.2722 4.03954 11.5847 3.98357 11.8093 4.15077L11.7816 4.03157Z' fill='white'/%3E%3C/svg%3E") no-repeat center;
  mask: url("data:image/svg+xml,%3Csvg width='15' height='15' viewBox='0 0 15 15' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M11.7816 4.03157C12.0062 4.19877 12.0622 4.51126 11.895 4.73586L7.14503 11.2359C7.06266 11.3453 6.93748 11.4141 6.80001 11.4254C6.66254 11.4367 6.52756 11.3894 6.42928 11.2954L3.67928 8.79544C3.47641 8.60818 3.46461 8.29097 3.65188 8.08809C3.83914 7.88522 4.15636 7.87342 4.35923 8.06069L6.70668 10.2369L11.105 4.26414C11.2722 4.03954 11.5847 3.98357 11.8093 4.15077L11.7816 4.03157Z' fill='white'/%3E%3C/svg%3E") no-repeat center;
}
</style>
