# Git 工作流程 - 跟踪上游项目并维护个人修改

## 场景说明

当你需要在本地学习一个开源项目，添加注释和笔记，同时又要保持跟踪官方项目的最新更新时，使用本文档描述的工作流程。

## 🎯 推荐方案：双远程仓库 + 功能分支策略

### 1️⃣ 设置双远程仓库

```bash
# 查看当前远程仓库
git remote -v

# 添加上游官方仓库为 upstream
git remote add upstream <官方仓库的URL>

# 验证配置
git remote -v
# 应该看到：
# origin    <你的仓库URL> (fetch)
# origin    <你的仓库URL> (push)
# upstream  <官方仓库URL> (fetch)
# upstream  <官方仓库URL> (push)
```

### 2️⃣ 分支策略（最佳实践）

创建专门的分支来管理你的修改：

```bash
# 保持 main 分支干净，仅用于同步官方
git checkout main

# 创建你的个人开发分支（存放注释和修改）
git checkout -b my-notes
# 或者：git checkout -b my-customizations

# 在 my-notes 分支上进行你的注释和修改
# ... 编辑代码，添加注释 ...

# 提交你的修改
git add .
git commit -m "添加项目学习注释"

# 推送到你的远程仓库
git push origin my-notes
```

### 3️⃣ 同步官方更新的工作流程

```bash
# 1. 切换到 main 分支
git checkout main

# 2. 从官方仓库拉取最新代码
git fetch upstream
git merge upstream/main
# 或者简写：git pull upstream main

# 3. 推送更新后的 main 到你的远程仓库（可选）
git push origin main

# 4. 将官方更新合并到你的个人分支
git checkout my-notes
git merge main

# 5. 如果有冲突，解决冲突后提交
# ... 解决冲突 ...
git add .
git commit -m "合并官方最新更新"
git push origin my-notes
```

## 🔧 方案对比

### 方案 A：Rebase 策略（适合线性历史爱好者）

```bash
# 在 my-notes 分支上
git checkout my-notes

# 更新 main
git checkout main
git pull upstream main
git push origin main

# 回到 my-notes，使用 rebase
git checkout my-notes
git rebase main

# 如果有冲突，逐个解决后：
git add <解决冲突的文件>
git rebase --continue

# 强制推送（因为改写了历史）
git push origin my-notes --force-with-lease
```

**优点：** 提交历史更清晰线性  
**缺点：** 需要强制推送，改写历史

### 方案 B：Merge 策略（推荐，更安全）

```bash
git checkout my-notes
git merge main  # 将官方更新合并进来
```

**优点：** 保留完整历史，更安全  
**缺点：** 会产生合并提交

## 💡 处理冲突的最佳实践

### 查看差异和选择策略

```bash
# 查看差异
git diff main my-notes -- <文件名>

# 冲突时选择策略：
git checkout --ours <文件>    # 保留你的版本
git checkout --theirs <文件>  # 使用官方版本

# 手动合并后
git add <文件>
git commit
```

### 减少冲突的技巧

1. **注释尽量添加在独立的行**，避免修改原有代码行
2. **使用特殊标记**来标识你的注释：
   ```typescript
   // [NOTE: 我的学习笔记] 这里是处理用户登录逻辑
   function login() {
     // 官方代码...
   }
   ```
3. **定期同步**：不要等太久才同步官方代码，建议每周或每次学习前先同步

## 📋 完整工作流程示例

### 初始设置（只需做一次）

```bash
# 1. 添加上游仓库
git remote add upstream <官方仓库URL>

# 2. 创建个人学习分支
git checkout -b my-notes

# 3. 推送分支到你的远程仓库
git push origin my-notes
```

### 日常工作流程

```bash
# === 添加注释和学习笔记 ===
vim packages/x/src/some-file.tsx
git add .
git commit -m "添加关于 XYZ 功能的学习注释"
git push origin my-notes

# === 定期同步官方更新（比如每周一次）===
# 1. 更新主分支
git checkout main
git pull upstream main
git push origin main

# 2. 合并到个人分支
git checkout my-notes
git merge main

# 3. 解决冲突（如果有）
# ... 手动解决冲突 ...
git add .
git commit -m "合并官方最新更新"
git push origin my-notes

# 4. 继续你的学习和注释工作
# ...循环上述步骤
```

## ✅ 方案总结

对于学习项目并添加注释的场景，推荐使用：

- ✅ **双远程仓库**（`origin` 是你的，`upstream` 是官方的）
- ✅ **main 分支保持干净**，仅用于跟踪官方
- ✅ **创建 `my-notes` 分支**存放你的注释和学习笔记
- ✅ **定期从 upstream 更新 main，然后 merge 到你的分支**
- ✅ **使用 merge 而不是 rebase**（除非你很熟悉 rebase）

这样既能跟踪官方最新代码，又能保留你的学习笔记，冲突也会最小化。

## 🔍 常见问题

### Q: 我应该多久同步一次官方代码？

**A:** 建议每周同步一次，或者在开始新的学习任务前先同步。频繁同步可以减少冲突的复杂度。

### Q: 如果冲突太多怎么办？

**A:** 可以考虑：

1. 使用 `git mergetool` 工具辅助解决冲突
2. 临时创建新分支测试合并
3. 如果冲突难以解决，可以基于最新的 main 创建新的学习分支，手动迁移重要注释

### Q: 我的注释会影响官方项目吗？

**A:** 不会。你的注释只在你自己的仓库和分支中，完全不会影响官方项目。

### Q: 可以向官方贡献代码吗？

**A:** 可以！当你发现 bug 或有改进建议时：

1. 从最新的 main 创建新的功能分支：`git checkout -b fix-bug-xxx`
2. 进行修改并提交
3. 推送到你的仓库：`git push origin fix-bug-xxx`
4. 在 GitHub 上创建 Pull Request 到官方仓库
