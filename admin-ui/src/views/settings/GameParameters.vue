<template>
  <div class="game-parameters-container">
    <h2>系统参数设定</h2>
    <p class="page-description">管理遊戏参数、金流参数等系统设定。</p>

    <el-card shadow="never" v-loading="loading">
      <el-tabs v-model="activeTab">
        
        <el-tab-pane label="遊戏参数 (Game)" name="Game">
          <el-form v-if="formGroups.Game" ref="gameFormRef" :model="formGroups.Game" label-width="200px" class="settings-form">
            <el-form-item
              label="派奖倍数 (PAYOUT_MULTIPLIER)"
              prop="PAYOUT_MULTIPLIER.value"
              :rules="[{ required: true, message: '派奖倍数不能为空' }, { validator: validateInteger, trigger: 'blur' }]"
            >
              <el-input v-model="formGroups.Game.PAYOUT_MULTIPLIER.value" style="width: 200px;" placeholder="请输入正整数">
                <template #append>倍</template>
              </el-input>
              <div class-="form-tip">{{ formGroups.Game.PAYOUT_MULTIPLIER.description }}</div>
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="handleSubmit('Game')" :loading="submitLoading">储存遊戏参数</el-button>
            </el-form-item>
          </el-form>
          <el-empty v-else description="無遊戏参数"></el-empty>
        </el-tab-pane>

        <el-tab-pane label="金流参数 (Finance)" name="Finance">
           <el-form v-if="formGroups.Finance" ref="financeFormRef" :model="formGroups.Finance" label-width="200px" class="settings-form">
            
            <el-form-item
              label="自动出款门槛 (AUTO_WITHDRAW_THRESHOLD)"
              prop="AUTO_WITHDRAW_THRESHOLD.value"
              :rules="[{ required: true, message: '门槛不能为空' }, { validator: validateNumeric, trigger: 'blur' }]"
            >
              <el-input v-model="formGroups.Finance.AUTO_WITHDRAW_THRESHOLD.value" style="width: 200px;" placeholder="例如: 10">
                <template #append>USDT</template>
              </el-input>
              <div class="form-tip">{{ formGroups.Finance.AUTO_WITHDRAW_THRESHOLD.description }}</div>
            </el-form-item>

             <el-form-item
              label="开放 TRC20 充值 (ALLOW_TRC20)"
              prop="ALLOW_TRC20.value"
              :rules="[{ required: true, message: '必须选择' }]"
            >
               <el-switch v-model="formGroups.Finance.ALLOW_TRC20.value" active-value="true" inactive-value="false" />
               <div class="form-tip">{{ formGroups.Finance.ALLOW_TRC20.description }}</div>
            </el-form-item>

             <el-form-item
              label="开放 BSC 充值 (ALLOW_BSC)"
              prop="ALLOW_BSC.value"
              :rules="[{ required: true, message: '必须选择' }]"
            >
               <el-switch v-model="formGroups.Finance.ALLOW_BSC.value" active-value="true" inactive-value="false" />
               <div class="form-tip">{{ formGroups.Finance.ALLOW_BSC.description }}</div>
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="handleSubmit('Finance')" :loading="submitLoading">储存金流参数</el-button>
            </el-form-item>
          </el-form>
           <el-empty v-else description="無金流参数"></el-empty>
        </el-tab-pane>
        
        <el-tab-pane label="其他参数" name="General">
           <el-form v-if="formGroups.General" ref="generalFormRef" :model="formGroups.General" label-width="200px" class="settings-form">
              <el-empty description="無其他参数"></el-empty>
           </el-form>
           <el-empty v-else description="無其他参数"></el-empty>
        </el-tab-pane>

      </el-tabs>
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
           activeTab: 'Game', // 预设显示哪個 tab
           
           // (★★★ v8.1 修改：表单结构改为分组 ★★★)
           formGroups: {
               // (预设结构，防止渲染错误)
               Game: null,
               Finance: null,
               General: null
           },
           
           // (保留原始 API 回传，用于比对)
           originalSettings: {}, 
       };
   },
   created() {
       this.fetchSettings();
   },
   methods: {
       // (★★★ v8.1 新增：数字验证 ★★★)
       validateNumeric (rule, value, callback) {
           // (注意：value 現在是 { value: '...', description: '...' } 中的 value)
           const num = parseFloat(value);
           if (isNaN(num) || num < 0) {
               callback(new Error('必须是非负数'));
           } else {
               callback(); 
           }
       },
       // (★★★ v8.1 新增：整数验证 ★★★)
       validateInteger (rule, value, callback) {
           const num = parseFloat(value);
           if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
               callback(new Error('必须是正整数'));
           } else {
               callback(); 
           }
       },

       async fetchSettings() {
            this.loading = true;
            try {
                // (★★★ v8.1 修改：API 現在返回分组的物件 ★★★)
                const settingsByCategory = await this.$api.getSettings();
                
                // (储存原始值，用于比对)
                this.originalSettings = JSON.parse(JSON.stringify(settingsByCategory));
                // (赋值给表单)
                this.formGroups = settingsByCategory;

                // (检查预设 tab 是否有内容)
                if (!this.formGroups[this.activeTab]) {
                    // 如果 'Game' 没内容，切换到 'Finance'
                    if (this.formGroups.Finance) this.activeTab = 'Finance';
                    else if (this.formGroups.General) this.activeTab = 'General';
                }

            } catch (error) {
                console.error('Failed to fetch settings:', error);
                ElMessage.error('载入设定失败');
            }
            finally { this.loading = false; }
       },
       
       // (★★★ v8.1 修改：按分组提交 ★★★)
       async handleSubmit(groupName) {
           const formRefName = `${groupName.toLowerCase()}FormRef`;
           const formEl = this.$refs[formRefName];
           if (!formEl) return;
           
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.submitLoading = true;
                   const settingsToUpdate = this.formGroups[groupName];
                   const originalGroupSettings = this.originalSettings[groupName] || {};
                   
                   try {
                       const updatePromises = [];
                       
                       // (只提交有变动的 key)
                       for (const key in settingsToUpdate) {
                           if (settingsToUpdate[key].value !== originalGroupSettings[key]?.value) {
                               updatePromises.push(
                                   this.$api.updateSetting(key, settingsToUpdate[key].value)
                               );
                           }
                       }

                       if (updatePromises.length === 0) {
                           ElMessage.info('设定未变动');
                           this.submitLoading = false;
                           return;
                       }

                       await Promise.all(updatePromises);
                       ElMessage.success('设定储存成功！');
                       
                       // (储存成功後重新载入所有设定，以更新 originalSettings)
                       await this.fetchSettings();

                   } catch (error) {
                        console.error('Failed to save settings:', error);
                        ElMessage.error('储存设定失败');
                   }
                   finally { this.submitLoading = false; }
               } else { 
                 ElMessage.error('表单验证失败');
                 return false; 
               }
           });
       }
   }
};
</script>

<style scoped>
.form-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.4; }
.settings-form {
  padding-top: 20px;
}
</style>