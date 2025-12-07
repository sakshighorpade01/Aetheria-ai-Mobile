# python-backend/custom_db.py (Definitive Version)

import logging
from agno.db.postgres import PostgresDb
from agno.sessions.team import TeamSession

logger = logging.getLogger(__name__)

class OptimizedPostgresDb(PostgresDb):
    """
    A custom PostgresDb class that optimizes session data before saving.
    It separates the static agent configuration from the dynamic run data
    by intercepting the session object, modifying it, and then passing it
    to the parent class's robust upsert method.
    """
    def upsert_session(self, session: TeamSession, deserialize: bool = True):
        """
        Overrides the default upsert method to perform optimization.
        """
        logger.debug(f"Running optimized upsert for session: {session.session_id}")

        try:
            # 1. Extract the runs from the session object.
            # We work with the Pydantic model objects directly here.
            original_runs = session.runs or []
            static_config = {}

            if original_runs:
                # 2. Find the system prompt from the latest run to store as the static config.
                latest_run_messages = original_runs[-1].messages or []
                for message in latest_run_messages:
                    if message.role == "system":
                        static_config = {"system_prompt": message.content}
                        break

                # 3. Clean the system prompt out of all runs to prevent duplication.
                for run in original_runs:
                    if run.messages:
                        run.messages = [msg for msg in run.messages if msg.role != "system"]

            # 4. Modify the session object IN-PLACE before passing it to the parent.
            #    This is the core of the elegant solution.
            
            # 4.1. Update the runs list with the cleaned runs.
            session.runs = original_runs

            # 4.2. Store the extracted static config in the generic 'metadata' field.
            #      The parent upsert method already knows how to handle this field.
            if session.metadata is None:
                session.metadata = {}
            session.metadata["static_config"] = static_config

            logger.info(f"Session {session.session_id} optimized. Passing to parent upsert method.")

        except Exception as e:
            # If our optimization logic fails for any reason, log the error but
            # proceed with the original, un-optimized session to prevent data loss.
            logger.error(f"Could not optimize session {session.session_id}: {e}. Saving original session.")

        # 5. Call the parent class's original upsert method.
        #    This reuses the framework's robust, battle-tested database logic.
        return super().upsert_session(session, deserialize)