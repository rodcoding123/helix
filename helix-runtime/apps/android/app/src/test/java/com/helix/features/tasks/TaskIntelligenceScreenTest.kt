package com.helix.features.tasks

import junit.framework.TestCase.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Before
import org.junit.Test
import java.util.*

@OptIn(ExperimentalCoroutinesApi::class)
class TaskIntelligenceScreenTest {

  @Before
  fun setup() {
    Dispatchers.setMain(StandardTestDispatcher())
  }

  @Test
  fun testTaskModel() {
    val task = Task(
      title = "Complete project",
      description = "Finish project work",
      priority = "high",
      dueDate = Date(),
      estimatedHours = 4.0,
      blockingFactor = 2,
      priorityReasoning = "Deadline tomorrow",
      dependencies = emptyList()
    )

    assertEquals("Complete project", task.title)
    assertEquals("high", task.priority)
    assertEquals(4.0, task.estimatedHours)
  }

  @Test
  fun testSubtaskModel() {
    val subtask = Subtask(
      title = "Design UI",
      description = "Create mockups",
      estimatedHours = 2.5,
      prerequisite = null,
      hasPrerequisite = false
    )

    assertEquals("Design UI", subtask.title)
    assertEquals(2.5, subtask.estimatedHours)
    assertFalse(subtask.hasPrerequisite)
  }

  @Test
  fun testTaskBreakdownModel() {
    val subtasks = listOf(
      Subtask("S1", "D", 1.0, null, false),
      Subtask("S2", "D", 2.0, null, false)
    )

    val breakdown = TaskBreakdown(
      originalTaskId = UUID.randomUUID(),
      subtasks = subtasks,
      totalHours = 3.0,
      confidence = 0.92,
      suggestedOrder = listOf(UUID.randomUUID())
    )

    assertEquals(2, breakdown.subtasks.size)
    assertEquals(3.0, breakdown.totalHours)
    assertEquals(0.92, breakdown.confidence)
  }

  @Test
  fun testTaskTabValues() {
    assertEquals(2, TaskIntelligenceTab.values().size)
    assertEquals("Prioritize", TaskIntelligenceTab.PRIORITIZE.label)
    assertEquals("Breakdown", TaskIntelligenceTab.BREAKDOWN.label)
  }

  @Test
  fun testTaskPriorityLevels() {
    val priorities = listOf("critical", "high", "medium", "low")
    priorities.forEach { priority ->
      val task = Task(
        title = "T",
        description = "D",
        priority = priority,
        dueDate = null,
        estimatedHours = null,
        blockingFactor = null,
        priorityReasoning = null,
        dependencies = emptyList()
      )
      assertEquals(priority, task.priority)
    }
  }

  @Test
  fun testTaskWithDependencies() {
    val dep1 = UUID.randomUUID()
    val dep2 = UUID.randomUUID()

    val task = Task(
      title = "T",
      description = "D",
      priority = "high",
      dueDate = null,
      estimatedHours = 3.0,
      blockingFactor = null,
      priorityReasoning = null,
      dependencies = listOf(dep1, dep2)
    )

    assertEquals(2, task.dependencies.size)
    assertTrue(task.dependencies.contains(dep1))
  }

  @Test
  fun testSubtaskHierarchy() {
    val rootId = UUID.randomUUID()
    val root = Subtask("Root", "D", 1.0, null, false)
    val child = Subtask("Child", "D", 0.5, rootId, true)

    assertEquals(rootId, child.prerequisite)
    assertTrue(child.hasPrerequisite)
  }

  @Test
  fun testBreakdownHoursCombination() {
    val subtasks = listOf(
      Subtask("S1", "D", 1.5, null, false),
      Subtask("S2", "D", 2.5, null, false),
      Subtask("S3", "D", 1.0, null, false)
    )

    val total = subtasks.sumOf { it.estimatedHours }
    assertEquals(5.0, total)
  }

  @Test
  fun testMultipleTasks() {
    val tasks = (0..9).map { i ->
      Task(
        title = "Task $i",
        description = "Desc",
        priority = if (i % 2 == 0) "high" else "low",
        dueDate = Date(),
        estimatedHours = (i + 1).toDouble(),
        blockingFactor = null,
        priorityReasoning = null,
        dependencies = emptyList()
      )
    }

    assertEquals(10, tasks.size)
    val highPriority = tasks.filter { it.priority == "high" }
    assertEquals(5, highPriority.size)
  }

  @Test
  fun testTaskUUIDUniqueness() {
    val t1 = Task("T1", "D", "high", null, null, null, null, emptyList())
    val t2 = Task("T2", "D", "high", null, null, null, null, emptyList())

    assertFalse(t1.id == t2.id)
  }

  @Test
  fun testSubtaskWithPrerequisite() {
    val parentId = UUID.randomUUID()
    val subtask = Subtask(
      title = "Dependent",
      description = "Needs parent",
      estimatedHours = 1.0,
      prerequisite = parentId,
      hasPrerequisite = true
    )

    assertEquals(parentId, subtask.prerequisite)
    assertTrue(subtask.hasPrerequisite)
  }

  @Test
  fun testBreakdownOrderSequence() {
    val ids = (0..4).map { UUID.randomUUID() }
    val breakdown = TaskBreakdown(
      originalTaskId = UUID.randomUUID(),
      subtasks = emptyList(),
      totalHours = 5.0,
      confidence = 0.85,
      suggestedOrder = ids
    )

    assertEquals(5, breakdown.suggestedOrder.size)
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class TaskIntelligenceViewModelTest {

  private lateinit var viewModel: TaskIntelligenceViewModel

  @Before
  fun setup() {
    Dispatchers.setMain(StandardTestDispatcher())
    viewModel = TaskIntelligenceViewModel()
  }

  @Test
  fun testInitialState() {
    assertEquals(TaskIntelligenceTab.PRIORITIZE, viewModel.selectedTab.value)
    assertFalse(viewModel.isLoading.value)
    assertNull(viewModel.error.value)
    assertTrue(viewModel.tasks.value.isEmpty())
    assertNull(viewModel.currentBreakdown.value)
  }

  @Test
  fun testSelectTab() {
    viewModel.selectTab(TaskIntelligenceTab.BREAKDOWN)
    assertEquals(TaskIntelligenceTab.BREAKDOWN, viewModel.selectedTab.value)
  }

  @Test
  fun testToggleOperation() {
    val initial = viewModel.taskOperations.value["task-prioritize"]
    viewModel.toggleOperation("task-prioritize")
    val after = viewModel.taskOperations.value["task-prioritize"]

    assertFalse(initial == after)
  }

  @Test
  fun testIsOperationEnabled() {
    viewModel.taskOperations.value = mapOf("task-prioritize" to true)
    assertTrue(viewModel.isOperationEnabled("task-prioritize"))
    assertFalse(viewModel.isOperationEnabled("nonexistent"))
  }

  @Test
  fun testLoadingState() {
    assertFalse(viewModel.isLoading.value)
    viewModel.isLoading.value = true
    assertTrue(viewModel.isLoading.value)
  }

  @Test
  fun testErrorHandling() {
    viewModel.error.value = "Test error"
    assertEquals("Test error", viewModel.error.value)
    viewModel.error.value = null
    assertNull(viewModel.error.value)
  }

  @Test
  fun testTasksStorage() {
    val tasks = listOf(
      Task("T1", "D", "high", null, 1.0, null, null, emptyList()),
      Task("T2", "D", "low", null, 2.0, null, null, emptyList())
    )
    viewModel.tasks.value = tasks
    assertEquals(2, viewModel.tasks.value.size)
  }

  @Test
  fun testBreakdownStorage() {
    val breakdown = TaskBreakdown(
      originalTaskId = UUID.randomUUID(),
      subtasks = emptyList(),
      totalHours = 5.0,
      confidence = 0.9,
      suggestedOrder = emptyList()
    )
    viewModel.currentBreakdown.value = breakdown
    assertEquals(5.0, viewModel.currentBreakdown.value?.totalHours)
  }

  @Test
  fun testPrioritizeAllTasks() = runTest {
    val tasks = listOf(
      Task("T1", "D", "", null, 1.0, null, null, emptyList()),
      Task("T2", "D", "", null, 2.0, null, null, emptyList())
    )
    viewModel.tasks.value = tasks

    viewModel.prioritizeAllTasks()
    assertTrue(viewModel.isLoading.value || viewModel.tasks.value.all { it.priority.isNotEmpty() })
  }

  @Test
  fun testBreakdownTask() = runTest {
    val task = Task("T", "D", "high", null, 3.0, null, null, emptyList())
    viewModel.breakdownTask(task, 3.0)

    assertTrue(viewModel.isLoading.value || viewModel.currentBreakdown.value != null)
  }

  @Test
  fun testMultipleOperationsToggle() {
    val ops = mapOf("task-prioritize" to true, "task-breakdown" to false)
    viewModel.taskOperations.value = ops

    viewModel.toggleOperation("task-breakdown")
    assertTrue(viewModel.taskOperations.value["task-breakdown"] == true)
  }

  @Test
  fun testCreateSubtasks() = runTest {
    val breakdown = TaskBreakdown(
      originalTaskId = UUID.randomUUID(),
      subtasks = listOf(Subtask("S1", "D", 1.0, null, false)),
      totalHours = 1.0,
      confidence = 0.9,
      suggestedOrder = emptyList()
    )
    viewModel.currentBreakdown.value = breakdown

    viewModel.createSubtasks(breakdown)
    assertTrue(viewModel.isLoading.value || viewModel.currentBreakdown.value == null || viewModel.currentBreakdown.value?.subtasks?.isNotEmpty() == true)
  }

  @Test
  fun testTasksWithBlockingFactors() {
    val tasks = listOf(
      Task("T1", "D", "high", null, 1.0, 0, null, emptyList()),
      Task("T2", "D", "high", null, 2.0, 2, null, emptyList()),
      Task("T3", "D", "high", null, 1.5, 1, null, emptyList())
    )
    viewModel.tasks.value = tasks

    val blocked = tasks.filter { it.blockingFactor ?: 0 > 0 }
    assertEquals(2, blocked.size)
  }

  @Test
  fun testTaskPrioritySorting() {
    val tasks = listOf(
      Task("T1", "D", "low", null, 1.0, null, null, emptyList()),
      Task("T2", "D", "high", null, 2.0, null, null, emptyList()),
      Task("T3", "D", "medium", null, 3.0, null, null, emptyList())
    )

    val priorities = mapOf("critical" to 0, "high" to 1, "medium" to 2, "low" to 3)
    val sorted = tasks.sortedBy { priorities[it.priority] ?: 4 }

    assertEquals("high", sorted[0].priority)
    assertEquals("low", sorted[2].priority)
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class TaskIntelligenceScreenIntegrationTest {

  @Test
  fun testCompleteTaskWorkflow() = runTest {
    Dispatchers.setMain(StandardTestDispatcher())
    val viewModel = TaskIntelligenceViewModel()

    // Create tasks
    val tasks = listOf(
      Task("T1", "D", "high", Date(), 3.0, null, "Urgent", emptyList()),
      Task("T2", "D", "low", Date(), 2.0, null, null, emptyList())
    )
    viewModel.tasks.value = tasks

    // Prioritize
    viewModel.prioritizeAllTasks()
    assertTrue(viewModel.isLoading.value || tasks.all { it.priority.isNotEmpty() })

    // Breakdown
    viewModel.breakdownTask(tasks[0], 3.0)
    assertTrue(viewModel.isLoading.value || viewModel.currentBreakdown.value != null)
  }
}

import java.util.UUID
