CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.agno_memories (
  memory_id character varying NOT NULL,
  memory json NOT NULL,
  input character varying,
  agent_id character varying,
  team_id character varying,
  user_id character varying,
  topics json,
  updated_at bigint,
  CONSTRAINT agno_memories_pkey PRIMARY KEY (memory_id)
);

ALTER TABLE public.agno_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memories" ON public.agno_memories
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own memories" ON public.agno_memories
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own memories" ON public.agno_memories
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own memories" ON public.agno_memories
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS public.agno_sessions (
  session_id character varying NOT NULL UNIQUE,
  session_type character varying NOT NULL,
  agent_id character varying,
  team_id character varying,
  workflow_id character varying,
  user_id character varying,
  session_data json,
  agent_data json,
  team_data json,
  workflow_data json,
  metadata json,
  runs json,
  summary json,
  created_at bigint NOT NULL,
  updated_at bigint,
  CONSTRAINT agno_sessions_pkey PRIMARY KEY (session_id)
);

ALTER TABLE public.agno_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON public.agno_sessions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.agno_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own sessions" ON public.agno_sessions
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own sessions" ON public.agno_sessions
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS public.attachment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL,
    CONSTRAINT attachment_session_id_idx UNIQUE (id)
);

CREATE INDEX IF NOT EXISTS idx_attachment_session_id ON public.attachment(session_id);
CREATE INDEX IF NOT EXISTS idx_attachment_user_id ON public.attachment(user_id);
CREATE INDEX IF NOT EXISTS idx_attachment_created_at ON public.attachment(created_at DESC);

ALTER TABLE public.attachment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own attachments" ON public.attachment
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attachments" ON public.attachment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attachments" ON public.attachment
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.request_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer DEFAULT 0,
  CONSTRAINT request_logs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own request logs" ON public.request_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own request logs" ON public.request_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.session_titles (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tittle text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  session_created_at bigint,
  CONSTRAINT session_titles_pkey PRIMARY KEY (session_id)
);

ALTER TABLE public.session_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session titles" ON public.session_titles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session titles" ON public.session_titles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session titles" ON public.session_titles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session titles" ON public.session_titles
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  scopes text[],
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_integrations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);