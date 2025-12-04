// 页面状态保存和恢复的 mixin
export default {
  data() {
    return {
      _pageStateKey: null
    };
  },
  activated() {
    // 组件激活时恢复状态
    if (this._pageStateKey) {
      this.restorePageState();
    }
  },
  beforeRouteLeave(to, from, next) {
    // 路由离开前保存状态
    if (this._pageStateKey) {
      this.savePageState();
    }
    next();
  },
  methods: {
    // 获取页面状态（子组件可以覆盖此方法）
    getPageState() {
      return {
        // 默认保存搜索参数和分页信息
        searchParams: this.searchParams || {},
        pagination: this.pagination || {},
        // 子组件可以扩展此方法添加更多状态
      };
    },
    // 恢复页面状态（子组件可以覆盖此方法）
    restorePageState(stateData) {
      if (!stateData) {
        // 从 sessionStorage 读取
        const stateKey = this.getStateKey();
        if (stateKey) {
          try {
            const saved = sessionStorage.getItem(stateKey);
            if (saved) {
              stateData = JSON.parse(saved);
            }
          } catch (e) {
            console.warn('Failed to restore page state:', e);
          }
        }
      }
      
      if (stateData) {
        // 恢复搜索参数
        if (stateData.searchParams && this.searchParams) {
          Object.assign(this.searchParams, stateData.searchParams);
        }
        // 恢复分页
        if (stateData.pagination && this.pagination) {
          Object.assign(this.pagination, stateData.pagination);
        }
        // 恢复其他状态（子组件可以扩展）
        if (stateData.otherState) {
          this.restoreOtherState(stateData.otherState);
        }
      }
    },
    // 保存页面状态
    savePageState() {
      const stateKey = this.getStateKey();
      if (!stateKey) return;
      
      const state = this.getPageState();
      state.scrollTop = document.querySelector('.layout-main')?.scrollTop || 0;
      state.timestamp = Date.now();
      
      try {
        sessionStorage.setItem(stateKey, JSON.stringify(state));
      } catch (e) {
        console.warn('Failed to save page state:', e);
      }
    },
    // 获取状态键
    getStateKey() {
      if (!this._pageStateKey && this.$route) {
        this._pageStateKey = `page_state_${this.$route.path}`;
      }
      return this._pageStateKey;
    },
    // 恢复其他状态（子组件可以覆盖此方法）
    restoreOtherState(otherState) {
      // 子组件可以覆盖此方法来恢复特定状态
    },
    // 清除页面状态（当分页被关闭后重新打开时调用）
    clearPageState() {
      const stateKey = this.getStateKey();
      if (stateKey) {
        try {
          sessionStorage.removeItem(stateKey);
        } catch (e) {
          console.warn('Failed to clear page state:', e);
        }
      }
    }
  },
  created() {
    // 检查是否有保存的状态
    const stateKey = this.getStateKey();
    if (stateKey) {
      try {
        const saved = sessionStorage.getItem(stateKey);
        if (!saved) {
          // 如果没有保存的状态，说明是首次打开或已被清除，使用默认状态
          this.clearPageState();
        }
      } catch (e) {
        // ignore
      }
    }
  }
};

