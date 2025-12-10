<template>
  <div class="page-container game-parameters-container">
    <h2>系统参数</h2>
    <p class="page-description">管理遊戏参数、金流参数、风控参数等系统设定。</p>

    <el-card shadow="never" v-loading="loading">
      <el-tabs v-model="activeTab">
        
        <el-tab-pane label="遊戏参数" name="Game">
          <el-form v-if="formGroups.Game" ref="gameFormRef" :model="formGroups.Game" label-width="200px" class="settings-form">
            <el-empty description="遊戏参数已遷移到遊戲管理頁面"></el-empty>
          </el-form>
          <el-empty v-else description="無遊戏参数"></el-empty>
        </el-tab-pane>

        <el-tab-pane label="金流参数" name="Finance">
           <el-form v-if="formGroups.Finance" ref="financeFormRef" :model="formGroups.Finance" label-width="200px" class="settings-form">
            
            <el-form-item
              label="自动出款门槛"
              prop="AUTO_WITHDRAW_THRESHOLD.value"
              :rules="[{ required: true, message: '门槛不能为空' }, { validator: validateNumeric, trigger: 'blur' }]"
            >
              <el-input v-model="formGroups.Finance.AUTO_WITHDRAW_THRESHOLD.value" style="width: 200px;" placeholder="例如: 10">
                <template #append>USDT</template>
              </el-input>
              <div class="form-tip">{{ formGroups.Finance.AUTO_WITHDRAW_THRESHOLD.description }}</div>
            </el-form-item>

             <el-form-item
              label="开放 TRC20 充值"
              prop="ALLOW_TRC20.value"
              :rules="[{ required: true, message: '必须选择' }]"
            >
               <el-switch v-model="formGroups.Finance.ALLOW_TRC20.value" active-value="true" inactive-value="false" />
               <div class="form-tip">{{ formGroups.Finance.ALLOW_TRC20.description }}</div>
            </el-form-item>

             <el-form-item
              label="开放 BSC 充值"
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

        <el-tab-pane label="风控参数" name="RiskControl">
           <el-form v-if="formGroups.RiskControl" ref="riskControlFormRef" :model="formGroups.RiskControl" label-width="200px" class="settings-form">
            <el-form-item
              label="同IP最大用户数"
              prop="MAX_SAME_IP_USERS.value"
              :rules="[{ required: true, message: '同IP最大用户数不能为空' }, { validator: validateInteger, trigger: 'blur' }]"
            >
              <el-input-number 
                v-model="formGroups.RiskControl.MAX_SAME_IP_USERS.value" 
                :min="1" 
                :max="100"
                :step="1"
                step-strictly
                style="width: 200px;" 
                placeholder="请输入正整数"
              />
              <div class="form-tip">{{ formGroups.RiskControl.MAX_SAME_IP_USERS.description }}</div>
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="handleSubmit('RiskControl')" :loading="submitLoading">储存风控参数</el-button>
            </el-form-item>
          </el-form>
           <el-empty v-else description="無风控参数"></el-empty>
        </el-tab-pane>
        
        <el-tab-pane label="其他参数" name="General">
           <el-form v-if="formGroups.General" ref="generalFormRef" :model="formGroups.General" label-width="200px" class="settings-form">
              <el-form-item
                label="平台名称"
                prop="PLATFORM_NAME.value"
                :rules="[{ required: true, message: '平台名称不能为空' }, { max: 50, message: '平台名称不能超过50个字符' }]"
              >
                <el-input v-model="formGroups.General.PLATFORM_NAME.value" style="width: 300px;" placeholder="请输入平台名称" maxlength="50" show-word-limit />
                <div class="form-tip">{{ formGroups.General.PLATFORM_NAME.description }}</div>
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="handleSubmit('General')" :loading="submitLoading">储存其他参数</el-button>
              </el-form-item>
           </el-form>
           <el-empty v-else description="無其他参数"></el-empty>
        </el-tab-pane>

        <el-tab-pane label="多语系" name="I18n">
          <el-form v-if="formGroups.I18n" ref="i18nFormRef" :model="formGroups.I18n" label-width="200px" class="settings-form">
            <el-form-item
              label="默认语言"
              prop="DEFAULT_LANGUAGE.value"
              :rules="[{ required: true, message: '默认语言不能为空' }]"
            >
              <el-select v-model="formGroups.I18n.DEFAULT_LANGUAGE.value" style="width: 200px;">
                <el-option label="简体中文 (zh-CN)" value="zh-CN" />
                <el-option label="English (en-US)" value="en-US" />
              </el-select>
              <div class="form-tip">{{ formGroups.I18n.DEFAULT_LANGUAGE.description }}</div>
            </el-form-item>
            
            <el-form-item
              label="支持的语言"
              prop="SUPPORTED_LANGUAGES.value"
            >
              <el-checkbox-group v-model="supportedLanguagesList">
                <el-checkbox label="zh-CN">简体中文</el-checkbox>
                <el-checkbox label="en-US">English</el-checkbox>
              </el-checkbox-group>
              <div class="form-tip">{{ formGroups.I18n.SUPPORTED_LANGUAGES.description }}</div>
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="handleSubmitI18n" :loading="submitLoading">储存多语系参数</el-button>
            </el-form-item>
          </el-form>
          <el-empty v-else description="無多语系参数"></el-empty>
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
               RiskControl: null,
               General: null,
               I18n: null
           },
           supportedLanguagesList: ['zh-CN', 'en-US'], // 支持的语言列表
           
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

                // 处理多语系配置
                if (this.formGroups.I18n && this.formGroups.I18n.SUPPORTED_LANGUAGES) {
                    const supportedLangs = this.formGroups.I18n.SUPPORTED_LANGUAGES.value;
                    if (supportedLangs) {
                        try {
                            this.supportedLanguagesList = JSON.parse(supportedLangs);
                        } catch (e) {
                            this.supportedLanguagesList = ['zh-CN', 'en-US'];
                        }
                    }
                }

                // (检查预设 tab 是否有内容)
                if (!this.formGroups[this.activeTab]) {
                    // 如果 'Game' 没内容，切换到 'Finance'
                    if (this.formGroups.Finance) this.activeTab = 'Finance';
                    else if (this.formGroups.RiskControl) this.activeTab = 'RiskControl';
                    else if (this.formGroups.General) this.activeTab = 'General';
                    else if (this.formGroups.I18n) this.activeTab = 'I18n';
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
                       let hasPlatformNameUpdate = false;
                       for (const key in settingsToUpdate) {
                           if (settingsToUpdate[key].value !== originalGroupSettings[key]?.value) {
                               if (key === 'PLATFORM_NAME') {
                                   hasPlatformNameUpdate = true;
                               }
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
                       
                       // (如果更新了平台名称，通知Layout组件刷新)
                       if (hasPlatformNameUpdate) {
                           // 触发全局事件，通知Layout组件重新加载平台名称
                           this.$nextTick(() => {
                               window.dispatchEvent(new CustomEvent('platformNameUpdated'));
                           });
                       }
                       
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
       },
       
       // 多语系参数提交
       async handleSubmitI18n() {
           const formEl = this.$refs.i18nFormRef;
           if (!formEl) return;
           
           await formEl.validate(async (valid) => {
               if (valid) {
                   this.submitLoading = true;
                   const settingsToUpdate = this.formGroups.I18n;
                   const originalGroupSettings = this.originalSettings.I18n || {};
                   
                   try {
                       const updatePromises = [];
                       
                       // 更新 DEFAULT_LANGUAGE
                       if (settingsToUpdate.DEFAULT_LANGUAGE.value !== originalGroupSettings.DEFAULT_LANGUAGE?.value) {
                           updatePromises.push(
                               this.$api.updateSetting('DEFAULT_LANGUAGE', settingsToUpdate.DEFAULT_LANGUAGE.value)
                           );
                       }
                       
                       // 更新 SUPPORTED_LANGUAGES（转换为 JSON 字符串）
                       const supportedLangsStr = JSON.stringify(this.supportedLanguagesList);
                       if (supportedLangsStr !== originalGroupSettings.SUPPORTED_LANGUAGES?.value) {
                           updatePromises.push(
                               this.$api.updateSetting('SUPPORTED_LANGUAGES', supportedLangsStr)
                           );
                       }
                       
                       if (updatePromises.length === 0) {
                           ElMessage.info('设定未变动');
                           this.submitLoading = false;
                           return;
                       }
                       
                       await Promise.all(updatePromises);
                       ElMessage.success('多语系参数储存成功');
                       
                       // 重新载入设定
                       await this.fetchSettings();
                       
                   } catch (error) {
                       console.error('Failed to update I18n settings:', error);
                       ElMessage.error('储存多语系参数失败');
                   } finally {
                       this.submitLoading = false;
                   }
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