<template>
  <div class="game-parameters-container">
    <h2>遊戲參數設定</h2>

    <el-card shadow="never" v-loading="loading">
      <el-form ref="formRef" :model="form" label-width="150px">
        <el-form-item label="派獎倍數" prop="PAYOUT_MULTIPLIER"
          :rules="[{ required: true, message: '派獎倍數不能為空' }, { validator: validateInteger, trigger: 'blur' }]">
          <el-input v-model="form.PAYOUT_MULTIPLIER.value" style="width: 200px;" placeholder="請輸入正整數">
             <template #append>倍</template>
          </el-input>
          <div class="form-tip">
            {{ form.PAYOUT_MULTIPLIER.description }} (v1 dApp 需要重啟後端服務才能生效)
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">儲存設定</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';

export default {
  name: 'GameParametersView',
   data() {
       return {
           loading: true,
           submitLoading: false,
           form: {
               // (預設結構，確保 template 渲染時不會報錯)
               PAYOUT_MULTIPLIER: { value: '', description: '' }
           },
       };
   },
   created() {
       // (★★★ 確保 created 中呼叫的是 methods 中的 fetchSettings ★★★)
       this.fetchSettings();
   },
   methods: {
       validateInteger (rule, value, callback) {
           let checkValue = value; 
           if (value && typeof value === 'object' && value.hasOwnProperty('value')) {
               checkValue = value.value; 
           } else {
           }

           // (後續驗證邏輯使用 checkValue)
           const num = parseInt(checkValue, 10);
           
           if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
               console.log('[Validator DEBUG] Validation FAILED.');
               callback(new Error('必須是正整數'));
           } else {
               console.log('[Validator DEBUG] Validation PASSED.');
               callback(); 
           }
       },
       async fetchSettings() {
            this.loading = true;
            try {
                // (★★★ 確保 $api.getSettings 可用 ★★★)
                const settings = await this.$api.getSettings();
                // (只更新存在的 key)
                for (const key in settings) {
                    if (this.form.hasOwnProperty(key)) {
                        // (★★★ 確保賦值正確 ★★★)
                        this.form[key] = {
                            value: settings[key].value || '', // API 返回的是 { value: '...', description: '...' }
                            description: settings[key].description || ''
                        };
                    } else {
                        // (如果 API 返回了 form 中不存在的 key，可以動態添加，但目前我們先忽略)
                        // console.warn(`Setting key '${key}' from API is not defined in the form.`);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
                ElMessage.error('載入設定失敗');
            }
            finally { this.loading = false; }
       },
       async handleSubmit() {
           const formEl = this.$refs.formRef;
           if (!formEl) return;
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.submitLoading = true;
                   try {
                       const updatePromises = Object.keys(this.form).map(key => {
                           // (★★★ 確保 $api.updateSetting 可用 ★★★)
                           return this.$api.updateSetting(key, this.form[key].value);
                       });
                       await Promise.all(updatePromises);
                       ElMessage.success('設定儲存成功');
                       // (儲存成功後最好重新載入一次，以獲取最新的 description 等)
                       await this.fetchSettings();
                   } catch (error) {
                        console.error('Failed to save settings:', error);
                        ElMessage.error('儲存設定失敗');
                   }
                   finally { this.submitLoading = false; }
               } else { return false; }
           });
       }
   }
};
</script>

<style scoped>
.form-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.4; }
</style>