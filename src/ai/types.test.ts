import { Infer } from "convex/values";
import {
  SerializeUrlsAndUint8Arrays,
  vAssistantContent,
  vFilePart,
  vImagePart,
  vReasoningPart,
  vRedactedReasoningPart,
  vTextPart,
  vToolCallPart,
  vToolContent,
} from "./types";
import { vUserContent } from "./types";
import {
  AssistantContent,
  FilePart,
  ImagePart,
  TextPart,
  ToolCallPart,
  ToolContent,
  UserContent,
} from "ai";

// type assertion
type OurUserContent = SerializeUrlsAndUint8Arrays<UserContent>;
const _userContent: Infer<typeof vUserContent> = [] as OurUserContent;
const _userContent2: OurUserContent = [] as Infer<typeof vUserContent>;

type OurAssistantContent = SerializeUrlsAndUint8Arrays<AssistantContent>;
const _assistantContent: Infer<typeof vAssistantContent> =
  [] as OurAssistantContent;
const _assistantContent2: OurAssistantContent = [] as Infer<
  typeof vAssistantContent
>;

type OurToolContent = SerializeUrlsAndUint8Arrays<ToolContent>;
const _toolContent: Infer<typeof vToolContent> = [] as OurToolContent;
const _toolContent2: OurToolContent = [] as Infer<typeof vToolContent>;

// type assertion
const _toolCallPart: Infer<typeof vToolCallPart> = {} as ToolCallPart;
const _toolCallPart2: ToolCallPart = {} as Infer<typeof vToolCallPart>;

// type assertion
type OurTextPart = SerializeUrlsAndUint8Arrays<TextPart>;
const _textPart: Infer<typeof vTextPart> = {} as OurTextPart;
const _textPart2: OurTextPart = {} as Infer<typeof vTextPart>;

// type assertion
type OurImagePart = SerializeUrlsAndUint8Arrays<ImagePart>;
const _imagePart: Infer<typeof vImagePart> = {} as OurImagePart;
const _imagePart2: OurImagePart = {} as Infer<typeof vImagePart>;

// type assertion
type OurFilePart = SerializeUrlsAndUint8Arrays<FilePart>;
const _filePart: Infer<typeof vFilePart> = {} as OurFilePart;
const _filePart2: OurFilePart = {} as Infer<typeof vFilePart>;

// narrow to the type
type ReasoningPart = AssistantContent[number] & { type: "reasoning" } & object;
type OurReasoningPart = SerializeUrlsAndUint8Arrays<ReasoningPart>;
const _reasoningPart: Infer<typeof vReasoningPart> = {} as OurReasoningPart;
const _reasoningPart2: OurReasoningPart = {} as Infer<typeof vReasoningPart>;

// narrow to the type
type RedactedReasoningPart = AssistantContent[number] & {
  type: "redacted-reasoning";
} & object;
type OurRedactedReasoningPart =
  SerializeUrlsAndUint8Arrays<RedactedReasoningPart>;
const _redactedReasoningPart: Infer<typeof vRedactedReasoningPart> =
  {} as OurRedactedReasoningPart;
const _redactedReasoningPart2: OurRedactedReasoningPart = {} as Infer<
  typeof vRedactedReasoningPart
>;
