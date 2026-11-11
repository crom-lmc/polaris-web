<script setup lang="ts">
/** 报警配置：页面结构对齐原型；规则读写接口后端尚未提供（job_alarm 表已建） */
</script>

<template>
  <section class="view">
    <div class="panel">
      <div class="panel-head">
        <span>全局通知渠道</span>
      </div>
      <div class="panel-body">
        <div class="form-row">
          <div class="form-item">
            <label>站内消息（复用消息中心 NoticeApi）</label>
            <div class="switch-line">
              <span class="switch off"></span>待接入 · 通知链路尚未联通
            </div>
          </div>
          <div class="form-item">
            <label>邮件</label>
            <div class="switch-line">
              <span class="switch off"></span>未开启（后续接 SMTP）
            </div>
          </div>
        </div>
        <div class="hint">同一任务 + 同一失败原因，静默期内只发一次；恢复后发送一条「已恢复」通知。</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span>报警规则</span>
        <div class="actions">
          <span class="tag tag-gray">优先级：任务级 &gt; 应用级 &gt; 全局</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>规则名称</th>
              <th>适用范围</th>
              <th>触发条件</th>
              <th>通知渠道</th>
              <th>接收人</th>
              <th>静默期</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8" class="empty-cell">
                报警规则读写接口尚未接入（job_alarm 表已建），当前无可展示的规则
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
