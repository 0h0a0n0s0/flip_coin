<template>
  <div class="page-container user-levels-container">
    <h2>用户等级设定</h2>
    <p class="page-description">管理用户等级及其升级条件和奖励。</p>

    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header>
         <div style="display: flex; justify-content: space-between; align-items: center;">
           <span>等级列表</span>
           <div style="display: flex; align-items: center; gap: 12px;">
             <el-button type="primary" @click="handleAdd">新增等级</el-button>
             <span style="color: #909399; font-size: 13px;">(等级必须从 1 开始連续设定)</span>
           </div>
         </div>
       </template>
      <el-table :data="tableData" class="user-levels-table" style="width: 100%" row-key="level" :table-layout="'auto'">
        <el-table-column prop="level" label="等级" width="80" sortable />
        <el-table-column prop="name" label="等级名称" width="150" />
        <el-table-column prop="required_total_bet_amount" label="累计投注金额(USDT)" width="200" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.required_total_bet_amount) }}</template>
        </el-table-column>
        <el-table-column prop="min_bet_amount_for_upgrade" label="注单有效阈值(USDT)" width="180" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.min_bet_amount_for_upgrade) }}</template>
        </el-table-column>
        <el-table-column prop="upgrade_reward_amount" label="升级奖励(USDT)" width="160" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.upgrade_reward_amount) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <div class="action-buttons-container">
              <el-button class="action-btn-edit" @click="handleEdit(scope.row)">编辑</el-button>
              <el-button class="action-btn-delete" @click="handleDelete(scope.row)" :disabled="scope.row.level === 1">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
       </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px" :close-on-click-modal="false">
      <el-form ref="levelFormRef" :model="levelForm" :rules="formRules" label-width="180px">
        <el-form-item label="等级" prop="level">
          <el-input-number v-model="levelForm.level" :min="1" :step="1" step-strictly :disabled="isEditMode" />
          <div class="form-tip" v-if="!isEditMode && nextLevel > 1">建议下一個等级为 {{ nextLevel }}</div>
        </el-form-item>
        <el-form-item label="等级名称" prop="name">
          <el-input v-model="levelForm.name" placeholder="例如: VIP 1, 新手"></el-input>
        </el-form-item>
         <el-form-item label="累计投注金额(USDT)" prop="required_total_bet_amount">
          <el-input-number v-model="levelForm.required_total_bet_amount" :min="0" :precision="8" placeholder="达到此等级所需的累计投注金额" />
           <div class="form-tip">达到此等级所需的累计投注金额（USDT）。Level 1 必须为 0。</div>
        </el-form-item>
         <el-form-item label="注单有效阈值(USDT)" prop="min_bet_amount_for_upgrade">
          <el-input-number v-model="levelForm.min_bet_amount_for_upgrade" :min="0" :precision="8" placeholder="单个投注的最小金额阈值" />
           <div class="form-tip">单个投注的有效性阈值（用于过滤垃圾投注）。只有金额大于等于此值的投注才会计入累加器。设为 0 表示不限制。</div>
        </el-form-item>
        <el-form-item label="升级奖励(USDT)" prop="upgrade_reward_amount">
          <el-input-number v-model="levelForm.upgrade_reward_amount" :min="0" :precision="8" placeholder="达到此等级时的奖励" />
           <div class="form-tip">用户达到此等级时获得的奖励（USDT）。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'UserLevelsView',
   data() {
       // (辅助验证函数)
       const validateNumeric = (rule, value, callback) => {
           if (value === null || value === undefined || value === '') {
               callback(new Error('此栏位不能为空'));
           } else if (typeof value !== 'number' || value < 0) {
               callback(new Error('必须是非负数'));
           } else {
               callback();
           }
       };
        const validateInteger = (rule, value, callback) => {
           if (value === null || value === undefined || value === '') {
                callback(new Error('此栏位不能为空'));
           } else if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
               callback(new Error('必须是非负整数'));
           } else {
               callback();
           }
       };

       return {
           loading: true,
           submitLoading: false,
           tableData: [], // { level, name, ... }
           dialogVisible: false,
           dialogTitle: '',
           isEditMode: false, // 区分新增或编辑
           levelForm: { // 表单数据
               level: null,
               name: '',
               required_total_bet_amount: null,
               min_bet_amount_for_upgrade: null,
               upgrade_reward_amount: null,
           },
           formRules: { // 表单验证规則
               level: [{ required: true, message: '等级不能为空', trigger: 'blur' }, { type: 'integer', min: 1, message: '等级必须是正整数', trigger: 'blur' }],
               name: [{ required: true, message: '等级名称不能为空', trigger: 'blur' }],
               required_total_bet_amount: [{ required: true, validator: validateNumeric, trigger: 'blur' }],
               min_bet_amount_for_upgrade: [{ required: true, validator: validateNumeric, trigger: 'blur' }],
               upgrade_reward_amount: [{ required: true, validator: validateNumeric, trigger: 'blur' }],
           }
       };
   },
   computed: {
       // 计算建议的下一個等级
       nextLevel() {
           if (!this.tableData || this.tableData.length === 0) return 1;
           // 找到目前最大的等级 + 1
           const maxLevel = Math.max(...this.tableData.map(item => item.level));
           return maxLevel + 1;
       }
   },
   created() {
       this.fetchLevels();
   },
   methods: {
       async fetchLevels() {
            this.loading = true;
            try {
                const response = await this.$api.getUserLevels();
                // (★★★ 修復：後端使用標準響應格式 { success: true, data: [...] } ★★★)
                if (response && response.success && response.data) {
                    this.tableData = Array.isArray(response.data) ? response.data : [];
                } else if (Array.isArray(response)) {
                    // 向後兼容：如果直接是數組
                    this.tableData = response;
                } else {
                    this.tableData = [];
                }
            } catch (error) { console.error('Failed to fetch user levels:', error); }
            finally { this.loading = false; }
       },
       handleAdd() {
           this.dialogTitle = '新增用户等级';
           this.isEditMode = false;
           // 重置表单，建议等级填入 nextLevel
           Object.assign(this.levelForm, { 
               level: this.nextLevel, 
               name: `Level ${this.nextLevel}`, 
               required_total_bet_amount: null,
               min_bet_amount_for_upgrade: null, 
               upgrade_reward_amount: null 
           });
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.levelFormRef?.clearValidate(); });
       },
       handleEdit(row) {
           this.dialogTitle = `编辑等级 ${row.level}`;
           this.isEditMode = true;
           // 将 row 的数据复制到表单 (需要确保後端返回的数字类型正确)
           Object.assign(this.levelForm, { 
               level: row.level, 
               name: row.name, 
               // (後端返回的是 string 或 number? 我们假设是 string，需要 parseFloat)
               required_total_bet_amount: parseFloat(row.required_total_bet_amount) || 0,
               min_bet_amount_for_upgrade: parseFloat(row.min_bet_amount_for_upgrade) || 0, 
               upgrade_reward_amount: parseFloat(row.upgrade_reward_amount) || 0 
           });
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.levelFormRef?.clearValidate(); });
       },
       async handleSubmit() {
           const formEl = this.$refs.levelFormRef;
           if (!formEl) return;
           await formEl.validate(async (valid) => {
               if (valid) {
                   // Level 1 的升级条件必须为 0
                   if (this.levelForm.level === 1) {
                       if (this.levelForm.required_total_bet_amount > 0) {
                           ElMessage.error('Level 1 的升级条件必须为 0');
                           return false;
                       }
                   }
                   
                   this.submitLoading = true;
                   try {
                       // 准备提交的数据 (移除 level，因为 level 在 URL 中)
                       const dataToSubmit = { ...this.levelForm };
                       if (this.isEditMode) {
                          // delete dataToSubmit.level; // PUT API URL 中已包含 level
                          await this.$api.updateUserLevel(this.levelForm.level, dataToSubmit);
                          ElMessage.success('等级更新成功');
                       } else {
                          await this.$api.addUserLevel(dataToSubmit);
                          ElMessage.success('等级新增成功');
                       }
                       this.dialogVisible = false;
                       await this.fetchLevels(); // 刷新列表
                   } catch (error) { 
                       console.error('Failed to submit user level:', error);
                       ElMessage.error(error.response?.data?.error || '操作失败');
                   }
                   finally { this.submitLoading = false; }
               } else { return false; }
           });
       },
       handleDelete(row) {
           ElMessageBox.confirm(`确定要刪除等级 ${row.level} (${row.name}) 吗？`, '警告', { confirmButtonText: '确定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteUserLevel(row.level);
                   ElMessage.success('等级刪除成功');
                   await this.fetchLevels(); // 刷新列表
               } catch (error) { console.error('Failed to delete user level:', error); }
           }).catch(() => {});
       },
       formatCurrency(value) {
           if (value === null || value === undefined) return '';
           if (typeof value === 'string') { try { value = parseFloat(value); } catch(e) { return 'N/A'; } }
           if (typeof value !== 'number') return 'N/A';
           return value.toFixed(8);
       }
   }
};
</script>

<style scoped>
.page-description { color: #909399; font-size: 14px; margin-bottom: 20px; }
.table-card { margin-bottom: 20px; }

/* 减少卡片body的padding，让表格更贴近边界 */
.table-card :deep(.el-card__body) {
  padding: 20px !important;
}
.el-form-item { margin-bottom: 20px; } /* 增加弹窗内间距 */
.form-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.4; }
/* 修正 input number 寬度 */
.el-input-number { width: 100%; }

/* 确保表格填满容器，减少右侧留白 */
.user-levels-table {
  width: 100% !important;
  table-layout: auto;
}

.table-card :deep(.user-levels-table) {
  width: 100% !important;
  margin: 0;
}

.table-card :deep(.user-levels-table .el-table__inner-wrapper) {
  width: 100% !important;
}

.table-card :deep(.user-levels-table .el-table__body-wrapper),
.table-card :deep(.user-levels-table .el-table__header-wrapper) {
  width: 100% !important;
  overflow-x: visible;
}

/* 确保表格列能够自动扩展填充空间 */
.table-card :deep(.user-levels-table .el-table__body),
.table-card :deep(.user-levels-table .el-table__header) {
  width: 100%;
  table-layout: auto;
}

/* 确保使用min-width的列能够自动扩展填充剩余空间 */
.table-card :deep(.user-levels-table colgroup col[min-width]) {
  width: auto !important;
  min-width: 240px;
}

/* 操作欄位按鈕容器 - 參考用戶列表樣式 */
.action-buttons-container {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

/* 操作欄位按鈕樣式 */
.action-btn-edit {
  background-color: #409eff !important;
  border-color: #409eff !important;
  color: #ffffff !important;
  margin: 0 !important;
}

.action-btn-edit:hover {
  background-color: #66b1ff !important;
  border-color: #66b1ff !important;
  color: #ffffff !important;
}

.action-btn-delete {
  background-color: #f56c6c !important;
  border-color: #f56c6c !important;
  color: #ffffff !important;
  margin: 0 !important;
}

.action-btn-delete:hover {
  background-color: #f78989 !important;
  border-color: #f78989 !important;
  color: #ffffff !important;
}

.action-btn-collect {
  background-color: #e6a23c !important;
  border-color: #e6a23c !important;
  color: #ffffff !important;
  margin: 0 !important;
}

.action-btn-collect:hover {
  background-color: #ebb563 !important;
  border-color: #ebb563 !important;
  color: #ffffff !important;
}
</style>