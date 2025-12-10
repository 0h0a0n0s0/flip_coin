<template>
  <el-dialog
    v-model="dialogVisible"
    title="波场异常通知"
    width="800px"
    :before-close="handleClose"
  >
    <div class="notification-list">
      <div 
        v-for="notification in notifications" 
        :key="notification.id"
        class="notification-item"
        :class="{ resolved: notification.resolved }"
      >
        <div class="notification-content">
          <div class="notification-message">{{ notification.message }}</div>
          <div class="notification-meta">
            <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
            <el-tag 
              :type="notification.resolved ? 'success' : 'danger'" 
              size="small"
            >
              {{ notification.resolved ? '已解决' : '未解决' }}
            </el-tag>
          </div>
        </div>
        <div class="notification-actions" v-if="!notification.resolved">
          <el-button 
            type="primary" 
            size="small"
            @click="resolveNotification(notification.id)"
          >
            标记为已解决
          </el-button>
        </div>
      </div>
      <div v-if="notifications.length === 0" class="empty-state">
        暂无异常通知
      </div>
    </div>
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'TronNotificationDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      notifications: [],
      loading: false
    };
  },
  computed: {
    dialogVisible: {
      get() {
        return this.modelValue;
      },
      set(val) {
        this.$emit('update:modelValue', val);
      }
    }
  },
  watch: {
    dialogVisible(newVal) {
      if (newVal) {
        this.loadNotifications();
      }
    }
  },
  methods: {
    async loadNotifications() {
      this.loading = true;
      try {
        const response = await this.$api.getTronNotifications({ resolved: false, limit: 100 });
        if (response.data && response.data.data) {
          this.notifications = response.data.data;
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
        ElMessage.error('加载通知失败');
      } finally {
        this.loading = false;
      }
    },
    async resolveNotification(id) {
      try {
        await this.$api.resolveTronNotification(id);
        ElMessage.success('已标记为已解决');
        // 重新加载通知列表
        await this.loadNotifications();
        // 通知父组件更新数量
        this.$emit('updated');
      } catch (error) {
        console.error('Failed to resolve notification:', error);
        ElMessage.error('操作失败');
      }
    },
    formatTime(timeStr) {
      if (!timeStr) return '';
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    },
    handleClose() {
      this.dialogVisible = false;
    }
  }
};
</script>

<style scoped>
.notification-list {
  max-height: 500px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  transition: background-color 0.2s ease;
}

.notification-item:hover {
  background-color: var(--bg-tertiary);
}

.notification-item.resolved {
  opacity: 0.6;
}

.notification-content {
  flex: 1;
}

.notification-message {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.5;
}

.notification-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.notification-actions {
  margin-left: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
  font-size: 14px;
}
</style>

