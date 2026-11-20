/* ==========================================================================
   ✏️  简历数据 —— 只需要修改这一整块，就能换成你自己的简历内容
   ========================================================================== */
export const RESUME = {
  // 岛屿 / 站点名称
  islandName: '星海旅岛 · 绘本版',
  name: '星海旅人',
  title: '全栈开发工程师 · 3D 交互爱好者',
  avatar: '🧑‍💻',
  tagline: '欢迎来到我的小岛！用 WASD 自由探索，走近建筑了解关于我的一切。',

  // 关于我
  about: {
    lines: [
      '你好！我是星海旅人，一名热爱创造的全栈开发工程师。',
      '喜欢把想法变成可交互的作品，最近迷上了 3D 网页和 AI 辅助创作（vibe coding）。',
      '坐标杭州，期待和有趣的人一起做有趣的事。'
    ],
    facts: [['坐标', '杭州'], ['经验', '5 年'], ['状态', '开放机会']]
  },

  // 技能
  skills: [
    { icon: '🎨', name: '前端', level: 92, items: ['React', 'Vue', 'TypeScript', 'Three.js', 'CSS 动画'] },
    { icon: '⚙️', name: '后端', level: 85, items: ['Node.js', 'Python', 'PostgreSQL', 'Redis', 'Docker'] },
    { icon: '🛠️', name: '工具 & 其他', level: 78, items: ['Git', 'Figma', 'Vibe Coding', 'AI 应用开发', '性能优化'] }
  ],

  // 工作经历
  experience: [
    { role: '高级前端工程师', company: '星际科技', period: '2022 — 至今', desc: '负责核心产品前端架构，主导 3D 可视化项目，带领 8 人小组交付多个关键版本。' },
    { role: '前端工程师', company: '云端网络', period: '2020 — 2022', desc: '从 0 到 1 搭建 SaaS 平台前端，交付多个百万级用户项目，推动组件库建设。' }
  ],

  // 项目经历
  projects: [
    { icon: '🏝️', name: '3D 小岛简历', desc: '用 Three.js 打造的可交互 3D 简历，aka 我的数字名片，面试官说像原神。', tags: ['Three.js', 'Vibe Coding'] },
    { icon: '🎨', name: 'AI 绘画工作台', desc: '集成多模型的 AI 创作平台，日活 1w+，支持一键生成与编辑。', tags: ['React', 'Node.js', 'AI'] },
    { icon: '📦', name: '开源组件库', desc: '服务 200+ 项目的内部组件库，GitHub Star 1.2k。', tags: ['Vue', '设计系统'] }
  ],

  // 联系方式
  contact: [
    { icon: '📧', label: '邮箱', value: 'hello@example.com', href: 'mailto:hello@example.com' },
    { icon: '🐙', label: 'GitHub', value: 'github.com/yourname', href: 'https://github.com/yourname' },
    { icon: '💬', label: '微信', value: 'your_wechat_id', href: '#' },
    { icon: '🌐', label: '个人站', value: 'your-site.com', href: 'https://your-site.com' }
  ]
};
