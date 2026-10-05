<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";
import ScaleScreen from "@/components/scale-screen";
import Headers from "./header.vue";
import Setting from "./setting.vue";
import { useSettingStore } from "@/stores/index";
import { storeToRefs } from "pinia";
import MessageContent from "@/components/Plugins/MessageContent";

const settingStore = useSettingStore();
const { isScale } = storeToRefs(settingStore);
const wrapperStyle = {};
</script>

<template>
  <scale-screen
    width="1920"
    height="1080"
    :delay="500"
    :fullScreen="false"
    :boxStyle="{
      background: '#03050C',
      overflow: isScale ? 'hidden' : 'auto',
    }"
    :wrapperStyle="wrapperStyle"
    :autoScale="isScale"
  >
    <div class="content_wrap">
      <Headers />
      <RouterView />
      <MessageContent />
      <div class="demo-badge">演示数据 · 全部为随机模拟（mock），不代表真实统计</div>
    </div>
  </scale-screen>
  <Setting />
</template>
<style lang="scss" scoped>
.content_wrap {
  width: 100%;
  height: 100%;
  padding: 16px 16px 16px 16px;
  box-sizing: border-box;
  position: relative;
  isolation: isolate;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: url("@/assets/img/pageBg.png") center center / cover;
    filter: $bg-filter;
  }
}
.demo-badge {
  position: absolute;
  left: 18px;
  bottom: 6px;
  z-index: 20;
  font-size: 12px;
  line-height: 18px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(0, 0, 0, 0.35);
  letter-spacing: 1px;
  pointer-events: none;
}
</style>
