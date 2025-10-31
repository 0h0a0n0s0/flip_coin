<template>
  <div class="user-levels-container">
    <h2>用戶等級設定</h2>
    <p class="page-description">管理用戶等級及其升級條件和獎勵。</p>

    <el-card shadow="never" class="action-card">
       <el-button type="primary" @click="handleAdd">新增等級</el-button>
       <span class="action-tip">(等級必須從 1 開始連續設定)</span>
    </el-card>

    <el-card shadow="never" class="table-card" v-loading="loading">
       <template #header><div>等級列表</div></template>
      <el-table :data="tableData" style="width: 100%" row-key="level">
        <el-table-column prop="level" label="等級" width="80" sortable />
        <el-table-column prop="name" label="等級名稱" width="150" />
        <el-table-column prop="max_bet_amount" label="投注限額 (ETH)" width="150" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.max_bet_amount) }}</template>
        </el-table-column>
        <el-table-column prop="required_bets_for_upgrade" label="升級所需注單數" width="160" sortable>
           <template #default="scope">{{ scope.row.required_bets_for_upgrade > 0 ? scope.row.required_bets_for_upgrade : '最高級' }}</template>
        </el-table-column>
        <el-table-column prop="min_bet_amount_for_upgrade" label="升級注單最小金額 (ETH)" width="200" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.min_bet_amount_for_upgrade) }}</template>
        </el-table-column>
        <el-table-column prop="upgrade_reward_amount" label="升級獎勵金額 (ETH)" width="180" sortable>
           <template #default="scope">{{ formatCurrency(scope.row.upgrade_reward_amount) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)" :disabled="scope.row.level === 1">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
       </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px" :close-on-click-modal="false">
      <el-form ref="levelFormRef" :model="levelForm" :rules="formRules" label-width="180px">
        <el-form-item label="等級" prop="level">
          <el-input-number v-model="levelForm.level" :min="1" :step="1" step-strictly :disabled="isEditMode" />
          <div class="form-tip" v-if="!isEditMode && nextLevel > 1">建議下一個等級為 {{ nextLevel }}</div>
        </el-form-item>
        <el-form-item label="等級名稱" prop="name">
          <el-input v-model="levelForm.name" placeholder="例如: VIP 1, 新手"></el-input>
        </el-form-item>
        <el-form-item label="投注限額 (ETH)" prop="max_bet_amount">
          <el-input-number v-model="levelForm.max_bet_amount" :min="0" :precision="8" placeholder="此等級最高投注額" />
        </el-form-item>
         <el-form-item label="升級所需注單數" prop="required_bets_for_upgrade">
          <el-input-number v-model="levelForm.required_bets_for_upgrade" :min="0" step-strictly placeholder="升到下一級所需注單數" />
           <div class="form-tip">設為 0 表示此等級為最高等級，無法再升級。</div>
        </el-form-item>
         <el-form-item label="升級注單最小金額 (ETH)" prop="min_bet_amount_for_upgrade">
          <el-input-number v-model="levelForm.min_bet_amount_for_upgrade" :min="0" :precision="8" placeholder="多少金額以上計入升級" />
           <div class="form-tip">只有投注額大於等於此金額的注單，才會計入「升級所需注單數」。</div>
        </el-form-item>
        <el-form-item label="升級獎勵金額 (ETH)" prop="upgrade_reward_amount">
          <el-input-number v-model="levelForm.upgrade_reward_amount" :min="0" :precision="8" placeholder="升到下一級的獎勵" />
           <div class="form-tip">用戶從上一級升到此等級時獲得的獎勵。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">確認</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';

export default {
  name: 'UserLevelsView',
   data() {
       // (輔助驗證函數)
       const validateNumeric = (rule, value, callback) => {
           if (value === null || value === undefined || value === '') {
               callback(new Error('此欄位不能為空'));
           } else if (typeof value !== 'number' || value < 0) {
               callback(new Error('必須是非負數'));
           } else {
               callback();
           }
       };
        const validateInteger = (rule, value, callback) => {
           if (value === null || value === undefined || value === '') {
                callback(new Error('此欄位不能為空'));
           } else if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
               callback(new Error('必須是非負整數'));
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
           isEditMode: false, // 區分新增或編輯
           levelForm: { // 表單數據
               level: null,
               name: '',
               max_bet_amount: null,
               required_bets_for_upgrade: null,
               min_bet_amount_for_upgrade: null,
               upgrade_reward_amount: null,
           },
           formRules: { // 表單驗證規則
               level: [{ required: true, message: '等級不能為空', trigger: 'blur' }, { type: 'integer', min: 1, message: '等級必須是正整數', trigger: 'blur' }],
               name: [{ required: true, message: '等級名稱不能為空', trigger: 'blur' }],
               max_bet_amount: [{ required: true, validator: validateNumeric, trigger: 'blur' }],
               required_bets_for_upgrade: [{ required: true, validator: validateInteger, trigger: 'blur' }],
               min_bet_amount_for_upgrade: [{ required: true, validator: validateNumeric, trigger: 'blur' }],
               upgrade_reward_amount: [{ required: true, validator: validateNumeric, trigger: 'blur' }],
           }
       };
   },
   computed: {
       // 計算建議的下一個等級
       nextLevel() {
           if (!this.tableData || this.tableData.length === 0) return 1;
           // 找到目前最大的等級 + 1
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
                this.tableData = await this.$api.getUserLevels();
            } catch (error) { console.error('Failed to fetch user levels:', error); }
            finally { this.loading = false; }
       },
       handleAdd() {
           this.dialogTitle = '新增用戶等級';
           this.isEditMode = false;
           // 重置表單，建議等級填入 nextLevel
           Object.assign(this.levelForm, { level: this.nextLevel, name: `Level ${this.nextLevel}`, max_bet_amount: null, required_bets_for_upgrade: null, min_bet_amount_for_upgrade: null, upgrade_reward_amount: null });
           this.dialogVisible = true;
           this.$nextTick(() => { this.$refs.levelFormRef?.clearValidate(); });
       },
       handleEdit(row) {
           this.dialogTitle = `編輯等級 ${row.level}`;
           this.isEditMode = true;
           // 將 row 的數據複製到表單 (需要確保後端返回的數字類型正確)
           Object.assign(this.levelForm, { 
               level: row.level, 
               name: row.name, 
               // (後端返回的是 string 或 number? 我們假設是 string，需要 parseFloat)
               max_bet_amount: parseFloat(row.max_bet_amount) || 0, 
               required_bets_for_upgrade: parseInt(row.required_bets_for_upgrade) || 0, 
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
                   this.submitLoading = true;
                   try {
                       // 準備提交的數據 (移除 level，因為 level 在 URL 中)
                       const dataToSubmit = { ...this.levelForm };
                       if (this.isEditMode) {
                          // delete dataToSubmit.level; // PUT API URL 中已包含 level
                          await this.$api.updateUserLevel(this.levelForm.level, dataToSubmit);
                          ElMessage.success('等級更新成功');
                       } else {
                          await this.$api.addUserLevel(dataToSubmit);
                          ElMessage.success('等級新增成功');
                       }
                       this.dialogVisible = false;
                       await this.fetchLevels(); // 刷新列表
                   } catch (error) { console.error('Failed to submit user level:', error); }
                   finally { this.submitLoading = false; }
               } else { return false; }
           });
       },
       handleDelete(row) {
           ElMessageBox.confirm(`確定要刪除等級 ${row.level} (${row.name}) 嗎？`, '警告', { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning' })
           .then(async () => {
               try {
                   await this.$api.deleteUserLevel(row.level);
                   ElMessage.success('等級刪除成功');
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
.action-card { margin-bottom: 20px; display: flex; align-items: center; }
.action-tip { color: #909399; font-size: 13px; margin-left: 15px; }
.table-card { margin-bottom: 20px; }
.el-form-item { margin-bottom: 20px; } /* 增加彈窗內間距 */
.form-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.4; }
/* 修正 input number 寬度 */
.el-input-number { width: 100%; }
</style>