/**
 * Result of extracting a work order from a screenshot via Claude Vision.
 * All fields except `detected` and `confidence` can be null if not found in
 * the image.
 */
export interface WorkOrderExtraction {
  detected: boolean
  workOrderNumber: string | null
  shortDescription: string | null
  siteName: string | null
  callType: string | null
  priority: string | null
  confidence: 'high' | 'medium' | 'low'
}
