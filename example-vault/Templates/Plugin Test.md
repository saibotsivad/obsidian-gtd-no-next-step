
In lieu of automated tests, here are the things to test when making changes.

Configuration:
- Folder: `Projects/`
- Next: `#next-step`
- Waiting: `#waiting-for`

#### 1. File with no tasks
Template:
```
file with no tasks
```
Action
- None
Expected outcome:
- [ ] The red badge "No Next" is shown

#### 2. File with tasks but no next/waiting
Template:
```
- [ ] this is a task
```
Action
- None
Expected outcome:
- [ ] The red badge "No Next" is shown

#### 3. File with only a waiting task
Template:
```
- [ ] this is a task #waiting-for
```
Action
- None
Expected outcome:
- [ ] The gray badge "Waiting" is shown

#### 4. Marking task as done, no tasks left
Template:
```
- [ ] this is a task #next-step
```
Action
- Mark the task as done by checking box
Expected outcome:
- [ ] No next step so the red "No Next" badge is shown

#### 5. No next, marking task as waiting
Template:
```
- [ ] this is a task
```
Action
- Add the tag `#waiting-for` to the task
Expected outcome:
- [ ] The gray "Waiting" badge appears

#### 6. Waiting task, marking as done
Template:
```
- [ ] this is a task #waiting-for
```
Action
- Mark the task as done by checking box
Expected outcome:
- [ ] The red "No Next" badge appears

#### 7. Waiting task, removing tag
Template:
```
- [ ] this is a task #waiting-for
```
Action
- Clear the tag from the task
Expected outcome:
- [ ] The red "No Next" badge appears

#### 8. Moving a project file out
Template:
```
- [ ] this is a task
```
Action
- Move out of the `Projects/` folder
Expected outcome:
- [ ] The red "No Next" badge is removed

#### 9. Moving a file into projects
Create a file outside the `Projects/` folder.
Template:
```
- [ ] this is a task
```
Action
- Move into the `Projects/` folder
Expected outcome:
- [ ] The red "No Next" badge is added
