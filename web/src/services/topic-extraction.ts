import type { ExtractedTopic, ConversationMessage } from '@/lib/types/memory';

/**
 * Topic extraction service using simple keyword-based analysis
 * Extracts 3-5 key topics from conversation content
 */
export class TopicExtractionService {
  /**
   * Extract 3-5 key topics from conversation messages
   * Uses keyword extraction and frequency analysis
   */
  async extractTopics(
    messages: ConversationMessage[]
  ): Promise<ExtractedTopic[]> {
    try {
      if (!messages || messages.length === 0) {
        return [];
      }

      // Combine all message content
      const combinedText = messages
        .map((msg) => msg.content)
        .join(' ')
        .toLowerCase();

      // Return early if combined text is empty or whitespace only
      if (!combinedText || !combinedText.trim()) {
        return [];
      }

      // Extract topics using keyword analysis
      const topics = this.extractKeywordTopics(combinedText);

      // Filter for non-empty topics and slice to 5 max
      const filtered = topics
        .filter((t) => t && t.trim().length > 0)
        .slice(0, 5);

      return filtered;
    } catch (error) {
      console.error('Failed to extract topics:', error);
      throw error;
    }
  }

  /**
   * Extract topics from text using keyword analysis
   */
  private extractKeywordTopics(text: string): string[] {
    const topics: Set<string> = new Set();

    // Define topic patterns: [pattern, topic name]
    const patterns: Array<[RegExp, string]> = [
      // Technology - be more specific and match various forms
      [/\breact\b|\breactjs\b|react\.js/gi, 'React'],
      [/\btypescript\b|\bts\b/gi, 'TypeScript'],
      [/\bjavascript\b|\bjs\b/gi, 'JavaScript'],
      [/node\.?js|\bnodejs\b/gi, 'Node.js'],
      [/supabase/gi, 'Supabase'],
      [/\bsetup\b|\bconfiguration\b|\binstall\b|\bbuilding\b|\bbuild\b/gi, 'Setup & Configuration'],
      [/\bdatabase\b|\bsql\b|\bpostgres\b|\bpostgresql\b/gi, 'Database'],
      [/\bauthentication\b|\bauth\b|\blogin\b|\bsignin\b/gi, 'Authentication'],
      [/\bapi\b|\brest\b|\bgraphql\b/gi, 'API Development'],
      [/\bcss\b|\bstyling\b|\btailwind\b|\bdesign\b/gi, 'Styling & Design'],
      [/machine learning|deep learning|\bml\b|\bneural\b/gi, 'Machine Learning'],
      [/\bai\b|artificial intelligence|\bnlp\b/gi, 'Artificial Intelligence'],
      [/\bweb\b|\bfrontend\b|\bbackend\b|full.?stack/gi, 'Web Development'],
      [/\bproject\b|\bdevelopment\b|\bengineering\b/gi, 'Project Development'],

      // Work & Career
      [/\bcareer\b|\bjob\b|\bemployment\b|\bwork\b/gi, 'Career'],
      [/product management|\bpm\b|\bproduct\b|\bmanagement\b/gi, 'Product Management'],
      [/\bcommunication\b|soft skills|\bskills\b/gi, 'Communication'],
      [/\bbusiness\b|\bmarket\b|\bcommerce\b/gi, 'Business'],

      // Personal & Psychology
      [/\bhealth\b|\bmedical\b|\bdoctor\b|\bappointment\b/gi, 'Health'],
      [/\bemotion\b|\bfeel\b|\bfeeling\b|\bmood\b|\bjoy\b/gi, 'Emotions'],
      [/\bgoal\b|\bgoals\b|\bobjective\b|\bplanning\b/gi, 'Goal Setting'],
      [/\blearning\b|\bstudy\b|\beducation\b|\buniversity\b/gi, 'Learning & Education'],
      [/\bproductivity\b|time management|\bschedule\b/gi, 'Productivity'],
      [/\brelationship\b|\bfriend\b|\bfamily\b|\bsocial\b/gi, 'Relationships'],
      [/personal growth|\bself.?improvement\b/gi, 'Personal Growth'],
      [/\banxiety\b|\bstress\b|\bworry\b|\bconcern\b/gi, 'Mental Health'],
      [/\bwork.?life\b|work.?balance|balance/gi, 'Work-Life Balance'],

      // General
      [/\bdata\b|\banalysis\b|\banalytics\b/gi, 'Data & Analytics'],
      [/\bsecurity\b|\bprivacy\b|\bsafe\b|\bprotection\b/gi, 'Security & Privacy'],
      [/\btesting\b|\btest\b|\bquality\b|\bqa\b/gi, 'Quality Assurance'],
      [/\bperformance\b|\boptimization\b|\bspeed\b|\befficiency\b/gi, 'Performance'],
    ];

    // Check each pattern and collect matching topics
    for (const [pattern, topicName] of patterns) {
      if (pattern.test(text)) {
        topics.add(topicName);
      }
    }

    // If not enough topics found with patterns, extract additional keywords
    if (topics.size < 3) {
      const words = text
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 4); // Words > 4 chars more likely to be topics

      // Get most frequent words
      const wordFreq = new Map<string, number>();
      for (const word of words) {
        const lowerWord = word.toLowerCase();
        // Skip common words
        if (!/^(that|this|with|from|have|been|were|also|want|like|think|about|would|could|should)$/.test(lowerWord)) {
          wordFreq.set(lowerWord, (wordFreq.get(lowerWord) || 0) + 1);
        }
      }

      const sortedWords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => {
          // Capitalize first letter
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .slice(0, 5 - topics.size);

      sortedWords.forEach(word => topics.add(word));
    }

    return Array.from(topics);
  }
}
