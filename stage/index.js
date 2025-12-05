// run-pipeline.js
import OpenAI from "openai";
import fs from "fs/promises";
import { stage1 } from "./prompt/stage.js";
import dayjs from "dayjs";

const client = new OpenAI({
  apiKey: 'sk-3caf022ff078597ccf3065212718f4ad0585252c1d7d66d2bdf8d6ab95769f31',
  baseURL: 'https://api.qnaigc.com/v1',
});

// ====== 这里填入你之前设计好的 System Prompts ======
// 为了不把文件写爆，这里用占位符；你实际使用时，把整段 prompt 字符串贴进去即可。

const STAGE1_SYSTEM_PROMPT = stage1;


// 一个小工具：统一调用 chat.completions
async function callModel({ system, user, responseFormat }) {
  const res = await client.chat.completions.create({
    model: "gemini-2.5-pro", // 或你想用的模型
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    // Stage 1 需要严格 JSON，就传 { type: "json_object" }
    // 其他阶段可以不传
    ...(responseFormat ? { response_format: responseFormat } : {}),
  });

  return res.choices[0].message.content;
}

// ===================== Stage 1 =====================
// 用户输入 → Blueprint JSON
async function runStage1(userQuestion) {
  const userMsg = `
下面是用户给出的题目或概念原文：

${userQuestion}

请你根据上面的内容，按系统说明生成唯一的 Blueprint JSON：
- 只输出一个 JSON 对象
- 顶层必须包含：meta, analysis, anchors, assets, timeline
- 不要输出任何额外文字、注释或 \`\`\` 标记
  `.trim();

  const content = await callModel({
    system: STAGE1_SYSTEM_PROMPT,
    user: userMsg,
  });

  const htmlMatch = content.match(/```html([\s\S]*?)```/);
  const htmlCode = htmlMatch ? htmlMatch[1].trim() : null;

  if (!htmlCode) {
    console.warn("没有找到 ```html 代码块，将完整输出当作 HTML 写入。");
    return content;
  }

  return htmlCode;

}

// ===================== 总管：一键跑三阶段 =====================
async function runPipeline(userQuestion) {
  const startTime = dayjs();
  console.log("Stage 1: 生成 Blueprint...");
  const blueprint = await runStage1(userQuestion);
  console.log("Stage 1: 生成 Blueprint 耗时：", dayjs().diff(startTime, "ms"));
  // console.log("Stage 2: 生成 Development Plan...");
  // const plan = await runStage2(blueprint);

  // console.log("Stage 3: 生成最终 HTML...");
  // const html = await runStage3(blueprint, plan);

  // 写入到本地文件
  const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  await fs.writeFile(`output_${timestamp}.html`, blueprint, "utf8");
  console.log(`✅ 已生成 output_${timestamp}.html`);
}

// 你可以在这里改成真正的用户输入
const userQuestion = "菲菲在商店买了 2 根跳绳和 1 个篮球，一共付了 50 元，售货员找给菲菲 1 元。如果买 1 个篮球的钱正好可以买 5 根跳绳，那么 1 根跳绳几元，1 个篮球几元";

runPipeline(userQuestion).catch((err) => {
  console.error("流水线执行出错：", err);
});
